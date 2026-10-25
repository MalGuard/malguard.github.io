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
