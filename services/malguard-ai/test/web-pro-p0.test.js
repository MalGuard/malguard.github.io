import test from 'node:test';
import assert from 'node:assert/strict';
import {modelsApiRoot,PRODUCTION_MODELS_ORIGIN} from '../../../ai/api-root.mjs';
import {accountApiBase,usesProductionAccountHost,PRODUCTION_ACCOUNT_ORIGIN as ACCOUNT_ORIGIN} from '../../../ai/account.mjs';
import {buildSearchQuery} from '../../../ai/search-query.mjs';
import {prepareStreamingMarkdown} from '../../../ai/code-view.mjs';
import {callCFModel} from '../../../ai/cloudflare-models.mjs';
import {createApp} from '../server/app.js';
import {readFileSync} from 'node:fs';
import {handlePreviewBackendProxy,isPreviewEnv,PREVIEW_BACKEND_ORIGIN,PRODUCTION_ACCOUNT_ORIGIN,PREVIEW_BYPASS_ENV} from '../server/preview-backend-proxy.mjs';

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

test('preview sign-in uses the production account host via the same-origin proxy',()=>{
  assert.equal(accountApiBase('malguard.site'),ACCOUNT_ORIGIN);
  assert.equal(accountApiBase('www.malguard.site'),ACCOUNT_ORIGIN);
  assert.equal(accountApiBase('malguard.github.io'),ACCOUNT_ORIGIN);
  assert.equal(accountApiBase('malguard-galaxy-mobile-test-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'),'');
  assert.equal(accountApiBase('malguard-galaxy-mobile-test-abc12def-mcazarderakhsh-4187.vercel.app'),'');
  assert.equal(accountApiBase('localhost'),'');
  assert.equal(usesProductionAccountHost('malguard.site'),true);
  assert.equal(usesProductionAccountHost('malguard-galaxy-mobile-test-git-web-pro-p0-mcazarderakhsh-4187.vercel.app'),true);
  assert.equal(usesProductionAccountHost('localhost'),false);
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

test('preview auth proxy forwards allowlisted account paths to the production account host without the bypass header',async()=>{
 const secret='unit-test-bypass-secret-value-32ch';
 const env={VERCEL_ENV:'preview',[PREVIEW_BYPASS_ENV]:secret};
 const blocked=mockRes();
 await handlePreviewBackendProxy({method:'POST',url:'/api/game-scam-guard/auth/logout',headers:{}},blocked,{env,fetchImpl:async()=>{throw new Error('should_not_fetch');}});
 assert.equal(blocked.statusCode,404);

 const production=mockRes();
 let called=false;
 await handlePreviewBackendProxy({method:'GET',url:'/api/preview-backend?path=auth-status',headers:{}},production,{env:{VERCEL_ENV:'production',[PREVIEW_BYPASS_ENV]:secret},fetchImpl:async()=>{called=true;throw new Error('should_not_fetch');}});
 assert.equal(production.statusCode,404);
 assert.equal(called,false);

 const sent=[];
 const ok=mockRes();
 await handlePreviewBackendProxy({method:'GET',url:'/api/game-scam-guard/auth/status',headers:{accept:'application/json'}},ok,{env,fetchImpl:async(url,options)=>{
  sent.push({url,headers:options.headers});
  return new Response(JSON.stringify({provider:'first-party-email',configured:true,persistentAccounts:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(ok.statusCode,200);
 assert.equal(sent[0].url,PRODUCTION_ACCOUNT_ORIGIN+'/api/game-scam-guard/auth/status');
 assert.equal(sent[0].headers['X-Vercel-Protection-Bypass'],undefined);
 assert.equal(sent[0].headers.Authorization,undefined);
 assert.equal(ok.body.configured,true);
 assert.ok(!JSON.stringify(ok.body).includes(secret));

 const session=mockRes();
 let sessionForward;
 await handlePreviewBackendProxy({
  method:'POST',url:'/api/preview-backend?path=auth-session',headers:{'content-type':'application/json',cookie:'should-not-forward=1',authorization:'Bearer should-not-forward'},body:{sessionToken:'placeholder-session-token'}
 },session,{env,fetchImpl:async(url,options)=>{
  sessionForward={url,headers:options.headers,body:String(options.body)};
  return new Response(JSON.stringify({email:'user@example.com',username:'user',expiresAt:1}),{status:200,headers:{'Content-Type':'application/json','Set-Cookie':'session=abc'}});
 }});
 assert.equal(sessionForward.url,PRODUCTION_ACCOUNT_ORIGIN+'/api/game-scam-guard/auth/session');
 assert.equal(sessionForward.headers['X-Vercel-Protection-Bypass'],undefined);
 assert.equal(sessionForward.headers.Authorization,undefined);
 assert.equal(sessionForward.headers.Cookie,undefined);
 assert.equal(session.headers['set-cookie'],undefined);
});

test('preview library proxy forwards GET and POST to the production account host with Origin and Authorization, never the bypass',async()=>{
 const secret='unit-test-bypass-secret-value-32ch';
 const env={VERCEL_ENV:'preview',[PREVIEW_BYPASS_ENV]:secret};
 const sent=[];
 const get=mockRes();
 await handlePreviewBackendProxy({
  method:'GET',url:'/api/malguard-library',headers:{accept:'application/json',authorization:'Bearer session-token-placeholder'}
 },get,{env,fetchImpl:async(url,options)=>{
  sent.push({url,headers:options.headers,method:options.method,body:options.body});
  return new Response(JSON.stringify({chats:[]}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(get.statusCode,200);
 assert.equal(sent[0].url,PRODUCTION_ACCOUNT_ORIGIN+'/api/malguard-library');
 assert.equal(sent[0].headers['X-Vercel-Protection-Bypass'],undefined);
 assert.equal(sent[0].headers.Authorization,'Bearer session-token-placeholder');
 assert.equal(sent[0].headers.Origin,'https://malguard.site');
 assert.equal(sent[0].headers.Cookie,undefined);

 const post=mockRes();
 await handlePreviewBackendProxy({
  method:'POST',url:'/api/malguard-library',headers:{'content-type':'application/json',authorization:'Bearer session-token-placeholder'},body:{chats:[{id:'c1'}]}
 },post,{env,fetchImpl:async(url,options)=>{
  sent.push({url,headers:options.headers,method:options.method,body:String(options.body)});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.equal(post.statusCode,200);
 assert.equal(sent[1].url,PRODUCTION_ACCOUNT_ORIGIN+'/api/malguard-library');
 assert.equal(sent[1].headers['X-Vercel-Protection-Bypass'],undefined);
 assert.equal(sent[1].headers.Authorization,'Bearer session-token-placeholder');
 assert.equal(sent[1].headers.Origin,'https://malguard.site');
 assert.match(sent[1].body,/c1/);

 const blocked=mockRes();
 await handlePreviewBackendProxy({method:'DELETE',url:'/api/malguard-library',headers:{}},blocked,{env,fetchImpl:async()=>{throw new Error('should_not_fetch');}});
 assert.equal(blocked.statusCode,404);

 const production=mockRes();
 let called=false;
 await handlePreviewBackendProxy({method:'GET',url:'/api/malguard-library',headers:{}},production,{env:{VERCEL_ENV:'production',[PREVIEW_BYPASS_ENV]:secret},fetchImpl:async()=>{called=true;throw new Error('should_not_fetch');}});
 assert.equal(production.statusCode,404);
 assert.equal(called,false);
});
