import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CF_DEFAULTS,fetchCFModels,unavailableCFModels,callCFModel} from '../../../ai/cloudflare-models.mjs';

const origin='https://models.malguard.site';
const expected=[
 {id:'chat_flash',mode:'chat',label:'Gemini 3.5 Flash-Lite',provider:'gemini',available:true},
 {id:'gemini_flash',mode:'chat',label:'Gemini 3.8 Flash',provider:'gemini',available:true},
 {id:'work_gemma',mode:'work',label:'Gemini 3.8 Flash · Work',provider:'gemini',available:true},
 {id:'code_gemini',mode:'code',label:'Gemini 3.8 Flash · Coding',provider:'gemini',available:true}
];
const sessionToken='synthetic-session-valid-user';

test('catalog loads ONLY verified gateway advertisements from Vercel, never from Workers',async()=>{
 let count=0;
 const found=await fetchCFModels({fetchImpl:async(url,options)=>{
  count++;assert.equal(url,origin+'/api/public-models');
  assert.equal(options.credentials,'omit');
  return Response.json({models:expected,accountQuota:{enabled:false}});
 }});
 assert.equal(count,1);
 assert.deepEqual(found.filter(m=>m.available).sort((a,b)=>a.id.localeCompare(b.id)),expected.slice().sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(found.accountQuotaEnabled,false);
 assert.deepEqual(CF_DEFAULTS,{chat:'chat_auto',work:'work_auto',code:'code_auto'});
 assert.ok(found.filter(m=>!m.available).every(x=>!expected.some(y=>y.id===x.id)));
});

test('chat, work and code pass signed-in session to Vercel API without exposing keys',async()=>{
 for(const [mode,model] of [['chat','chat_flash'],['work','work_gemma'],['code','code_gemini']]){
  let sent=0;
  const result=await callCFModel({mode,model,message:'سلام',history:[],sessionToken,fetchImpl:async(url,options)=>{
   sent++;assert.equal(url,origin+'/api/public-model-chat');
   assert.equal(options.headers.Authorization,'Bearer '+sessionToken);
   assert.equal(options.credentials,'omit');
   assert.ok(!url.includes(sessionToken));
   const body=JSON.parse(options.body);
   assert.deepEqual(body.consent,{modelShare:true});
   assert.equal(body.mode,mode);assert.equal(body.model,model);
   assert.ok(!JSON.stringify(body).includes('API_KEY'));
   return Response.json({text:'سلام!',provider:'gemini',model:'gemini-3.8-flash',modelId:model});
  }});
  assert.equal(sent,1);
  assert.equal(result.text,'سلام!');
  assert.equal(result.provider,'gemini');
  assert.equal(result.selectedModel,model);
 }
});
test('provider errors return the real rate-limit code, not a generic disconnected message',async()=>{
 await assert.rejects(callCFModel({mode:'chat',model:'chat_flash',message:'hi',sessionToken,
  fetchImpl:async()=>Response.json({error:'provider_rate_limited',retryAfterSeconds:38},{status:429})
 }),error=>error.status===429&&error.code==='provider_rate_limited'&&error.retryAfterSeconds===38);
});
test('missing session fails closed before any model request',async()=>{
 let called=false;
 await assert.rejects(callCFModel({mode:'chat',model:'chat_flash',message:'hi',
  fetchImpl:async()=>{called=true;throw Error('should not be called');}
 }),/sign_in_required/);
 assert.equal(called,false);
});
test('server model identities cannot be changed by untrusted catalog',async()=>{
 const models=await fetchCFModels({fetchImpl:async()=>Response.json({models:[
  {id:'chat_flash',mode:'code',label:'fake',provider:'gemini',available:true},
  {id:'code_gemini',mode:'code',label:'fake',provider:'wrong',available:true},
  {id:'work_gemma',mode:'work',label:'Gemini',provider:'gemini',available:true}
 ]})});
 assert.deepEqual(models.filter(m=>m.available).map(m=>m.id),['work_gemma']);
 assert.ok(unavailableCFModels().every(m=>m.available===false));
});
test('standalone Safari app has its own identity and no overlay report button',()=>{
 const html=readFileSync(new URL('../../../ai/index.html',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../../../ai/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/ai/');
 assert.equal(manifest.scope,'/ai/');
 assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
 assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
 assert.match(html,/connect-src[^\"]+https:\/\/game-scam-guard-connected\.vercel\.app https:\/\/models\.malguard\.site/);
 assert.match(html,/app\.js\?v=media-v5-20261108/);
 assert.doesNotMatch(html,/report-launcher\.js/);
});
test('model reconnection refreshes the catalog when Safari app resumes',()=>{
 const source=readFileSync(new URL('../../../ai/app.js',import.meta.url),'utf8');
 assert.match(source,/async function retryCloudConnections\(\)/);
 assert.match(source,/Promise\.allSettled\(\[loadCFModels\(\),loadCloudStatus\(\)\]\)/);
 assert.match(source,/window\.addEventListener\('pageshow',refreshOnReturn\)/);
 assert.match(source,/cfModels\.filter\(m=>m\.available&&m\.mode===cfMode\)/);
});

test('restored flagship Nemotron Ultra and free Qwen3 choices match real Vercel provider IDs',async()=>{
 const server=[
  {id:'chat_nemotron',mode:'chat',label:'Nemotron 3 Super · Chat · Free',provider:'openrouter',available:true},
  {id:'work_qwen',mode:'work',label:'Qwen3 30B · Work · Free',provider:'openrouter',available:true},
  {id:'code_ultra',mode:'code',label:'Nemotron 3 Ultra 550B · Free',provider:'openrouter',available:true},
  {id:'code_super',mode:'code',label:'Nemotron 3 Super 120B · Free',provider:'openrouter',available:true}
 ];
 const models=await fetchCFModels({fetchImpl:async()=>Response.json({models:server})});
 assert.deepEqual(models.filter(m=>m.available).map(x=>x.id).sort(),server.map(x=>x.id).sort());
 for(const {id,mode,provider} of server){
  const result=await callCFModel({mode,model:id,message:'سلام',history:[],sessionToken,
   fetchImpl:async(url,opts)=>{
    assert.equal(url,origin+'/api/public-model-chat');
    assert.equal(JSON.parse(opts.body).model,id);
    assert.equal(opts.headers.Authorization,'Bearer '+sessionToken);
    return Response.json({text:'سلام!',provider,model:'verified-synthetic-fixture',modelId:id});
   }});
  assert.equal(result.selectedModel,id);
  assert.equal(result.provider,'openrouter');
 }
});
