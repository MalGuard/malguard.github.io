import test from 'node:test';
import assert from 'node:assert/strict';
import {modelsApiRoot,PRODUCTION_MODELS_ORIGIN} from '../../../ai/api-root.mjs';
import {buildSearchQuery} from '../../../ai/search-query.mjs';
import {prepareStreamingMarkdown} from '../../../ai/code-view.mjs';
import {callCFModel} from '../../../ai/cloudflare-models.mjs';
import {createApp} from '../server/app.js';
import {readFileSync} from 'node:fs';
import {handlePreviewBackendProxy,isPreviewEnv,PREVIEW_BACKEND_ORIGIN,PREVIEW_BYPASS_ENV} from '../server/preview-backend-proxy.mjs';

test('preview frontend hosts talk to the matching malware-ai preview, production stays on models.malguard.site',()=>{
  assert.equal(modelsApiRoot('malguard.site'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('www.malguard.site'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('malguard.github.io'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(modelsApiRoot('localhost'),PRODUCTION_MODELS_ORIGIN);
  assert.equal(
    modelsApiRoot('malguard-galaxy-mobile-test-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'),
    ''
  );
  assert.equal(
    modelsApiRoot('malguard-galaxy-mobile-test-abc12def-mcazarderakhsh-4187.vercel.app'),
    ''
  );
  assert.equal(modelsApiRoot('unrelated.vercel.app'),PRODUCTION_MODELS_ORIGIN);
});

test('search query uses the full question and recent conversation, not only the first clipped line',()=>{
  const query=buildSearchQuery('What is the capital of France?\nPlease cite sources.',[
    {role:'user',content:'We were discussing European cities.'},
    {role:'assistant',content:'Sure.'}
  ]);
  assert.match(query,/capital of France/);
  assert.match(query,/European cities/);
  assert.ok(!/[{}<>]/.test(query));
  const punct=buildSearchQuery('قیمت دلار امروز چند است؟');
  assert.match(punct,/دلار/);
  const embedded=buildSearchQuery('Fix the login form.\n```\nBuild source below:\nprivate code\n```',[],{clientQuery:'Fix the login form.'});
  assert.equal(embedded,'Fix the login form.');
  assert.doesNotMatch(embedded,/private code/);
});

test('open fences render as closed code during streaming and partial tables stay stable',()=>{
  const fenced=prepareStreamingMarkdown('Intro\n```js\nconst n = 1;');
  assert.match(fenced,/```js\nconst n = 1;\n```$/);
  const table=prepareStreamingMarkdown('| Name | Count |\n| Ada | 2 |');
  assert.match(table,/\|\s*---/);
  assert.equal(prepareStreamingMarkdown('```js\nconst n = 1;\n```'),'```js\nconst n = 1;\n```');
});

test('legacy chat without a session returns 401 sign_in_required',async t=>{
  const server=createApp({enabled:true,log:()=>{}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const r=await fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://malguard.github.io'},body:JSON.stringify({message:'hello',mode:'chat',consent:{modelShare:true}})});
  assert.equal(r.status,401);
  assert.equal((await r.json()).error,'sign_in_required');
});

test('cloud chat streams tokens from SSE without waiting for a final JSON body',async()=>{
  const chunks=[];
  const events=[
    'event: status\ndata: {"phase":"search"}\n\n',
    'event: token\ndata: {"text":"Hello"}\n\n',
    'event: token\ndata: {"text":" world"}\n\n',
    'event: done\ndata: {"text":"Hello world","model":"gpt-oss-20b","provider":"groq","modelId":"chat_flash"}\n\n'
  ].join('');
  const result=await callCFModel({
    mode:'chat',model:'chat_flash',message:'سلام',history:[],sessionToken:'synthetic-session-valid-user',
    stream:true,onToken:text=>chunks.push(text),
    fetchImpl:async()=>new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}})
  });
  assert.equal(result.text,'Hello world');
  assert.deepEqual(chunks,['Hello','Hello world']);
  assert.equal(result.provider,'groq');
});

test('preview CSP and Web Pro badge are present on the AI shell',()=>{
  const html=readFileSync(new URL('../../../ai/index.html',import.meta.url),'utf8');
  assert.match(html,/malware-ai-git-web-pro-p0-mcazarderakhsh-4187\.vercel\.app/);
  assert.match(html,/web-pro-badge/);
  assert.match(html,/id="stop-generation"/);
  assert.match(html,/alt="MalGuard AI"/);
});
test('sidebar Settings is translated in fa and /ai/ CSP still overrides ACAO without dropping connect-src',()=>{
  const nav=readFileSync(new URL('../../../ai/navigation.mjs',import.meta.url),'utf8');
  assert.match(nav,/settingsLabel/);
  assert.match(nav,/const settingsWord=fa\?'تنظیمات':'Settings'/);
  assert.match(nav,/settingsSummary.setAttribute\('aria-label',settingsWord\)/);
  const vercel=JSON.parse(readFileSync(new URL('../../../vercel.json',import.meta.url),'utf8'));
  const ai=vercel.headers.find(h=>h.source==='/ai/(.*)');
  assert.ok(ai);
  const acao=ai.headers.find(h=>h.key==='Access-Control-Allow-Origin');
  assert.equal(acao?.value,'');
  const csp=ai.headers.find(h=>h.key==='Content-Security-Policy')?.value||'';
  assert.match(csp,/https:\/\/models\.malguard\.site/);
  assert.match(csp,/malware-ai-git-web-pro-p0-mcazarderakhsh-4187\.vercel\.app/);
});

function mockRes(){
 const res={statusCode:200,headers:{},chunks:[],ended:false};
 res.status=code=>{res.statusCode=code;return res;};
 res.setHeader=(k,v)=>{res.headers[String(k).toLowerCase()]=v;};
 res.json=payload=>{res.body=payload;res.ended=true;return res;};
 res.write=buf=>res.chunks.push(Buffer.from(buf));
 res.end=buf=>{if(buf!=null)res.chunks.push(Buffer.from(buf));res.ended=true;if(res.body==null&&res.chunks.length){res.raw=Buffer.concat(res.chunks);const type=res.headers['content-type']||'';if(type.includes('json')){try{res.body=JSON.parse(res.raw.toString());}catch{res.text=res.raw.toString();}}else res.text=res.raw.toString();}};
 return res;
}

test('production and non-preview builds disable the backend proxy with 404',async()=>{
 assert.equal(isPreviewEnv({}),false);
 assert.equal(isPreviewEnv({VERCEL_ENV:'production'}),false);
 assert.equal(isPreviewEnv({VERCEL_ENV:'development'}),false);
 assert.equal(isPreviewEnv({VERCEL_ENV:'preview'}),true);
 let called=false;
 for(const env of [{}, {VERCEL_ENV:'production'}, {VERCEL_ENV:'development'}]){
  const res=mockRes();
  await handlePreviewBackendProxy({method:'GET',url:'/api/preview-backend?path=public-models',headers:{}},res,{env,fetchImpl:async()=>{called=true;throw new Error('should_not_fetch');}});
  assert.equal(res.statusCode,404);
  assert.equal(res.body.error,'not_found');
 }
 assert.equal(called,false);
});

test('preview proxy only forwards allowlisted paths and never leaks the bypass secret',async()=>{
 const secret='unit-test-bypass-secret-value-32ch';
 const env={VERCEL_ENV:'preview',[PREVIEW_BYPASS_ENV]:secret};
 const denied=mockRes();
 await handlePreviewBackendProxy({method:'GET',url:'/api/preview-backend?path=../env',headers:{}},denied,{env,fetchImpl:async()=>{throw new Error('should_not_fetch');}});
 assert.equal(denied.statusCode,404);

 const missing=mockRes();
 await handlePreviewBackendProxy({method:'GET',url:'/api/preview-backend?path=public-models',headers:{}},missing,{env:{VERCEL_ENV:'preview'},fetchImpl:async()=>{throw new Error('should_not_fetch');}});
 assert.equal(missing.statusCode,503);
 assert.equal(missing.body.error,'preview_proxy_unconfigured');
 assert.ok(!JSON.stringify(missing.body).includes(secret));

 const sent=[];
 const ok=mockRes();
 await handlePreviewBackendProxy({method:'GET',url:'/api/preview-backend?path=public-models',headers:{accept:'application/json'}},ok,{env,fetchImpl:async(url,options)=>{
  sent.push({url,headers:options.headers});
  assert.equal(url,PREVIEW_BACKEND_ORIGIN+'/api/public-models');
  return new Response(JSON.stringify({models:[{id:'groq_gptoss20',available:true}]}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(ok.statusCode,200);
 assert.equal(sent[0].headers['X-Vercel-Protection-Bypass'],secret);
 assert.equal(ok.body.models[0].id,'groq_gptoss20');
 assert.ok(!JSON.stringify(ok.body).includes(secret));
 assert.ok(!Object.values(ok.headers).some(value=>String(value).includes(secret)));
});

test('preview proxy forwards Authorization and streams SSE tokens',async()=>{
 const secret='unit-test-bypass-secret-value-32ch';
 const env={VERCEL_ENV:'preview',[PREVIEW_BYPASS_ENV]:secret};
 const events=['event: status\ndata: {"phase":"search"}\n\n','event: token\ndata: {"text":"Hello"}\n\n'].join('');
 const res=mockRes();
 let forwarded;
 await handlePreviewBackendProxy({
  method:'POST',url:'/api/public-model-chat',headers:{authorization:'Bearer session-token-test','content-type':'application/json',accept:'text/event-stream'},body:{mode:'chat',model:'chat_auto',message:'hi',stream:true}
 },res,{env,fetchImpl:async(url,options)=>{
  forwarded={url,headers:options.headers,body:options.body};
  return new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}});
 }});
 assert.equal(forwarded.url,PREVIEW_BACKEND_ORIGIN+'/api/public-model-chat');
 assert.equal(forwarded.headers.Authorization,'Bearer session-token-test');
 assert.equal(forwarded.headers['X-Vercel-Protection-Bypass'],secret);
 assert.equal(res.statusCode,200);
 assert.match(res.headers['content-type'],/event-stream/);
 assert.match(res.text,/Hello/);
 assert.ok(!res.text.includes(secret));
});
