import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CF_DEFAULTS,fetchCFModels,unavailableCFModels,callCFModel} from '../../../ai/cloudflare-models.mjs';

const origin='https://models.malguard.site';
const sessionToken='synthetic-session-valid-user';
const granite={id:'chat_granite',mode:'chat',label:'Granite 4 Micro · Fast',provider:'workers_ai',available:true};

test('only the backend-matched Granite chat model is enabled',async()=>{
 let count=0;
 const found=await fetchCFModels({fetchImpl:async(url,options)=>{
  count++;assert.equal(url,origin+'/api/public-models');
  assert.equal(options.credentials,'omit');
  return Response.json({models:[granite,{id:'work_qwen',mode:'work',label:'Qwen',provider:'workers_ai',available:true}]});
 }});
 assert.equal(count,1);
 assert.deepEqual(found.filter(m=>m.available).map(m=>m.id),['chat_granite']);
 assert.deepEqual(CF_DEFAULTS,{chat:'chat_granite',work:'work_auto',code:'code_auto'});
 assert.ok(unavailableCFModels().every(m=>m.available===false));
});

test('Granite chat sends a backend-compatible request and keeps the session token in Authorization',async()=>{
 let sent=0;
 const result=await callCFModel({mode:'chat',model:'chat_granite',message:'سلام',history:[],sessionToken,
  fetchImpl:async(url,options)=>{
   sent++;assert.equal(url,origin+'/api/public-model-chat');
   assert.equal(options.headers.Authorization,'Bearer '+sessionToken);
   assert.equal(options.credentials,'omit');
   const body=JSON.parse(options.body);
   assert.deepEqual(Object.keys(body).sort(),['history','message','mode','model']);
   assert.equal(body.mode,'chat');assert.equal(body.model,'chat_granite');
   assert.equal(body.message,'سلام');
   assert.ok(!JSON.stringify(body).includes('API_KEY'));
   return Response.json({text:'سلام! من MalGuard AI هستم.',provider:'workers_ai',model:'@cf/ibm-granite/granite-4.0-h-micro',modelId:'chat_granite'});
  }});
 assert.equal(sent,1);
 assert.equal(result.text,'سلام! من MalGuard AI هستم.');
 assert.equal(result.provider,'workers_ai');
 assert.equal(result.selectedModel,'chat_granite');
});

test('provider errors preserve the real rate-limit code',async()=>{
 await assert.rejects(callCFModel({mode:'chat',model:'chat_granite',message:'hi',sessionToken,
  fetchImpl:async()=>Response.json({error:'provider_rate_limited',retryAfterSeconds:38},{status:429})
 }),error=>error.status===429&&error.code==='provider_rate_limited'&&error.retryAfterSeconds===38);
});

test('missing session fails closed before any model request',async()=>{
 let called=false;
 await assert.rejects(callCFModel({mode:'chat',model:'chat_granite',message:'hi',
  fetchImpl:async()=>{called=true;throw Error('should not be called');}
 }),/sign_in_required/);
 assert.equal(called,false);
});

test('a forged or mismatched model advertisement cannot enable a model',async()=>{
 const models=await fetchCFModels({fetchImpl:async()=>Response.json({models:[
  {...granite,mode:'code'},
  {...granite,provider:'fake_provider'},
  {...granite,available:false},
  granite
 ]})});
 assert.deepEqual(models.filter(m=>m.available).map(m=>m.id),['chat_granite']);
});

test('standalone Safari app keeps its own identity and required gateway origin',()=>{
 const html=readFileSync(new URL('../../../ai/index.html',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../../../ai/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/ai/');
 assert.equal(manifest.scope,'/ai/');
 assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
 assert.match(html,/connect-src[^\"]+https:\/\/models\.malguard\.site/);
 assert.doesNotMatch(html,/report-launcher\.js/);
});

test('model reconnection refreshes the catalog when Safari app resumes',()=>{
 const source=readFileSync(new URL('../../../ai/app.js',import.meta.url),'utf8');
 assert.match(source,/async function retryCloudConnections\(\)/);
 assert.match(source,/Promise\.allSettled\(\[loadCFModels\(\),loadCloudStatus\(\)\]\)/);
 assert.match(source,/window\.addEventListener\('pageshow',refreshOnReturn\)/);
 assert.match(source,/cfModels\.filter\(m=>m\.available&&m\.mode===cfMode\)/);
});
