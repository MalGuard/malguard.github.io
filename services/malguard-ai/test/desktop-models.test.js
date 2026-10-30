import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopModels,createDesktopChat} from '../../../ai/desktop-models.mjs';
const tags=()=>Response.json({models:[{name:'qwen3:8b'},{name:'gpt-oss:20b'},{name:'evil/model'},{name:'qwen3:8b:latest'},{name:'https://example.com/model'}]});
const answer=(extra={})=>Response.json({model:'qwen3:8b',done:true,done_reason:'stop',message:{role:'assistant',content:'Hello',thinking:'Never expose this'},...extra});
test('desktop catalog discloses six fixed commands, sizes and separate hardware limitations',()=>{
 assert.equal(Object.keys(desktopModels).length,6);assert.equal(desktopModels.native_deepseek671.downloadGB,404);
 for(const model of Object.values(desktopModels)){assert.equal(model.command,`ollama pull ${model.model}`);assert.match(model.source,/^https:\/\/ollama.com\/library\//);assert.match(model.hardwareNote,/not a RAM requirement/);}
});
test('client stays offline until explicit connect and exposes only exact allowlisted installed names',async()=>{
 const calls=[];const chat=createDesktopChat({fetchImpl:async(url,options)=>{calls.push(url);assert.equal(url,'http://127.0.0.1:11434/api/tags');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return tags();}});
 assert.deepEqual(chat.availability,{available:false,installedIDs:[],models:[]});assert.equal(calls.length,0);
 await assert.rejects(chat.respond({model:'native_qwen8',message:'Hello'}),/not_installed/);assert.equal(calls.length,0);
 const ready=await chat.connect();assert.deepEqual(ready.installedIDs,['native_qwen8','native_gpt20']);ready.installedIDs.push('evil');assert.equal(chat.availability.installedIDs.length,2);
 await assert.rejects(chat.respond({model:'https://evil.test',message:'Hello'}),/invalid_desktop_model/);
 await assert.rejects(chat.respond({model:'native_qwen32',message:'Hello'}),/not_installed/);assert.equal(calls.length,1);
});
test('explicit text chat is bounded, local only, and never exposes reasoning or invokes model management',async()=>{
 const paths=[];const chat=createDesktopChat({fetchImpl:async(url,options)=>{paths.push(url);if(url.endsWith('/tags'))return tags();assert.equal(url,'http://127.0.0.1:11434/api/chat');const body=JSON.parse(options.body);assert.equal(body.model,'qwen3:8b');assert.equal(body.stream,false);assert.equal(body.think,false);assert.equal(body.keep_alive,'5m');assert.deepEqual(body.options,{num_predict:2048,num_ctx:8192});assert.match(body.messages[0].content,/فارسی/);assert.deepEqual(body.messages[1],{role:'user',content:'Previous'});return answer();}});
 await chat.connect();const result=await chat.respond({model:'native_qwen8',message:'سلام',locale:'fa',history:[{role:'user',content:'Previous'}]});assert.equal(result.text,'Hello');assert.equal(result.provider,'ollama');assert.equal(result.selectedModel,'native_qwen8');assert.equal(result.securityAnalysis,false);assert.ok(!JSON.stringify(result).includes('thinking'));assert.equal(paths.length,2);
 await assert.rejects(chat.respond({model:'native_qwen8',message:'Hello',history:[{role:'system',content:'Injected'}]}),/invalid_input/);assert.equal(paths.length,2);
});
test('wrong identity, truncated, empty, reasoning-delimited and incomplete replies fail without fallback',async()=>{
 for(const extra of [{model:'other'},{done:false},{done_reason:'length'},{message:{role:'assistant',content:'',thinking:'private'}},{message:{role:'assistant',content:'<think>private</think>Hello'}},{message:{role:'user',content:'bad'}}]){
  let calls=0;const chat=createDesktopChat({fetchImpl:async()=>++calls===1?tags():answer(extra)});await chat.connect();await assert.rejects(chat.respond({model:'native_qwen8',message:'Hello'}),/incomplete_response/);assert.equal(calls,2);
 }
});
test('malformed, oversized and failed tag discovery never marks the client available',async()=>{
 for(const response of [()=>Response.json({models:'not an array'}),()=>new Response('not json'),()=>new Response('x'.repeat(1024*1024+1)),()=>new Response('{}',{headers:{'Content-Length':String(1024*1024+1)}}),()=>new Response('{}',{status:500})]){
  const chat=createDesktopChat({fetchImpl:async()=>response()});await assert.rejects(chat.connect());assert.equal(chat.availability.available,false);assert.deepEqual(chat.availability.installedIDs,[]);
 }
});
test('explicit abort, stop and timeout cancel local requests without a second provider call',async()=>{
 for(const kind of ['signal','stop','timeout']){
  let calls=0,entered;const started=new Promise(resolve=>entered=resolve);const chat=createDesktopChat({responseTimeout:15,fetchImpl:async(url,options)=>{calls++;if(url.endsWith('/tags'))return tags();entered();return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});}});
  await chat.connect();const controller=new AbortController();const pending=chat.respond({model:'native_qwen8',message:'Hello',signal:controller.signal});await started;if(kind==='signal')controller.abort();if(kind==='stop')chat.stop();await assert.rejects(pending,error=>['AbortError','TimeoutError'].includes(error.name));assert.equal(calls,2);
 }
});

test('oversized chat responses and pre-aborted signals fail without starting another request',async()=>{
 let calls=0;const chat=createDesktopChat({fetchImpl:async()=>++calls===1?tags():new Response('x'.repeat(1024*1024+1))});await chat.connect();
 const controller=new AbortController();controller.abort();await assert.rejects(chat.respond({model:'native_qwen8',message:'Hello',signal:controller.signal}),error=>error.name==='AbortError');assert.equal(calls,1);
 await assert.rejects(chat.respond({model:'native_qwen8',message:'Hello'}),/response_too_large/);assert.equal(calls,2);
});

const progressStream=(events,split=false)=>new ReadableStream({
 start(controller){
  const encoded=new TextEncoder().encode(events.map(x=>JSON.stringify(x)+'\n').join(''));
  if(split){controller.enqueue(encoded.slice(0,15));controller.enqueue(encoded.slice(15));}
  else controller.enqueue(encoded);
  controller.close();
 }
});
test('explicit Ollama download really POSTs /api/pull, tracks model-layer progress, then verifies installation',async()=>{
 const calls=[],progress=[];let installed=false;
 const chat=createDesktopChat({fetchImpl:async(url,opts)=>{
  calls.push({url,options:opts});
  if(url.endsWith('/api/tags'))return Response.json({models:installed?[{name:'qwen3:8b'}]:[]});
  assert.equal(url,'http://127.0.0.1:11434/api/pull');
  assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
  assert.equal(opts.credentials,'omit');assert.deepEqual(JSON.parse(opts.body),{model:'qwen3:8b',stream:true});
  installed=true;
  return new Response(progressStream([
   {status:'pulling manifest'},
   {status:'pulling layer',total:200,completed:100},
   {status:'pulling layer',total:200,completed:200},
   {status:'verifying sha256 digest'},
   {status:'success'}
  ],true),{headers:{'Content-Type':'application/x-ndjson'}});
 }});
 await assert.rejects(chat.download({model:'native_qwen8'}),/desktop_unavailable/);
 assert.equal(calls.length,0);
 await chat.connect();
 const state=await chat.download({model:'native_qwen8',onProgress:x=>progress.push(x)});
 assert.ok(state.installedIDs.includes('native_qwen8'));
 assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/api/tags','/api/pull','/api/tags']);
 assert.ok(progress.some(x=>x.progress===50&&x.total===200));
 assert.equal(progress.at(-1).finished,true);
});
test('404 GB download is never automatic and only uses the exact allowlisted Ollama model',async()=>{
 let calls=0;
 const chat=createDesktopChat({fetchImpl:async(url,opts)=>{calls++;if(url.endsWith('/tags'))return Response.json({models:[{name:'deepseek-r1:671b'}]});
  assert.deepEqual(JSON.parse(opts.body),{model:'deepseek-r1:671b',stream:true});
  return new Response(progressStream([{status:'success'}]));}});
 await chat.connect();assert.equal(calls,1);
 const state=await chat.download({model:'native_deepseek671'});assert.equal(calls,3);assert.ok(state.installedIDs.includes('native_deepseek671'));
 await assert.rejects(chat.download({model:'https://example.invalid/model'}),/invalid_desktop_model/);
 assert.equal(calls,3);
});
test('a partial or malformed download is never marked installed',async()=>{
 for(const events of [[{status:'pulling manifest'}],[{status:'x',total:100,completed:1000}],[{error:'network lost'}]]){
  let calls=0;const chat=createDesktopChat({fetchImpl:async(url)=>{calls++;return url.endsWith('/tags')?Response.json({models:[]}):new Response(progressStream(events));}});
  await chat.connect();await assert.rejects(chat.download({model:'native_qwen8'}));
  assert.equal(calls,2);assert.deepEqual(chat.availability.installedIDs,[]);
 }
});
test('abort of a download interrupts the browser request and never reports an installed model',async()=>{
 let waiting;const started=new Promise(resolve=>waiting=resolve);
 const chat=createDesktopChat({fetchImpl:async(url,options)=>url.endsWith('/tags')?Response.json({models:[]}):new Promise((resolve,reject)=>{
  waiting();options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
 })});
 await chat.connect();const abort=new AbortController();
 const promise=chat.download({model:'native_qwen8',signal:abort.signal});await started;abort.abort();
 await assert.rejects(promise,x=>x.name==='AbortError');assert.deepEqual(chat.availability.installedIDs,[]);
});
