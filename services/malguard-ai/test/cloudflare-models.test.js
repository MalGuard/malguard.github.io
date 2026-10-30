import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CF_DEFAULTS,fetchCFModels,unavailableCFModels,fetchCFUsage,callCFModel} from "../../../ai/cloudflare-models.mjs";

const models=[
 {id:"chat_granite",mode:"chat",label:"Granite 4 Micro",available:true,provider:"workers_ai"},
 {id:"chat_flash",mode:"chat",label:"Gemini Flash-Lite",available:true,provider:"gemini"},
 {id:"work_qwen",mode:"work",label:"Qwen3 30B",available:true,provider:"workers_ai"},
 {id:"work_gemma",mode:"work",label:"Gemma 4 31B",available:true,provider:"gemini"},
 {id:"code_super",mode:"code",label:"Nemotron 3 Super",available:true,provider:"workers_ai"},
 {id:"code_ultra",mode:"code",label:"Nemotron 3 Ultra",available:true,provider:"openrouter"}
];
test("model catalog uses Cloudflare Worker endpoint only, not Vercel",async()=>{
 const fetchImpl=async(url,options)=>{
  assert.equal(url,"https://malware-ai.malguard-security.workers.dev/api/public-models");
  assert.equal(options.credentials,"omit");
  return Response.json({models});
 };
 const got=await fetchCFModels({fetchImpl});
 assert.equal(got.length,22);
 assert.deepEqual(got.filter(m=>m.available),models);
 assert.equal(got.filter(m=>!m.available).length,16);
 assert.deepEqual(CF_DEFAULTS,{chat:"chat_granite",work:"work_qwen",code:"code_ultra"});
});
test("chat/work/code send only to Cloudflare worker without API secrets",async()=>{
 for(const [mode,model] of [["chat","chat_granite"],["work","work_qwen"],["code","code_ultra"]]){
  let count=0;
  const result=await callCFModel({mode,model,message:"hello",sessionToken:"synthetic-session-valid-user",quotaEnabled:true,history:[{role:"user",content:"prior"}],fetchImpl:async(url,options)=>{
   count++;
   assert.equal(url,"https://malware-ai.malguard-security.workers.dev/api/public-model-chat");
   assert.ok(!JSON.stringify(options).includes("sk-"));
   assert.equal(JSON.parse(options.body).model,model);
   assert.equal(JSON.parse(options.body).mode,mode);
   assert.equal(options.headers.Authorization,'Bearer synthetic-session-valid-user');
   return Response.json({text:"answer",provider:"workers_ai",model:"sample-model",modelId:model,fallback:false});
  }});
  assert.equal(count,1);assert.equal(result.text,"answer");assert.equal(result.selectedModel,model);
 }
});
test('free-provider fallback is disabled by default and forwarded only with explicit opt-in',async()=>{
 const sent=[];
 const fetchImpl=async(_,options)=>{
  sent.push(JSON.parse(options.body));
  return Response.json({text:'safe reply',provider:'workers_ai',model:'safe-model',modelId:'chat_granite'});
 };
 await callCFModel({mode:'chat',model:'chat_granite',message:'hello',fetchImpl});
 await callCFModel({mode:'chat',model:'chat_granite',message:'hello',freeFallback:true,fetchImpl});
 assert.deepEqual(sent.map(body=>body.freeFallback),[false,true]);
});
test("Cloudflare failure returns code without silently changing to a different host",async()=>{
 await assert.rejects(callCFModel({mode:"chat",model:"chat_granite",message:"hello",sessionToken:"synthetic-session-valid-user",quotaEnabled:true,fetchImpl:async()=>Response.json({error:"provider_rate_limited",retryAfterSeconds:47},{status:429})}),e=>e.status===429&&e.code==="provider_rate_limited"&&e.retryAfterSeconds===47);
});
test("existing site styling stays untouched and CSP permits direct Cloudflare",()=>{
 const html=readFileSync(new URL("../../../ai/index.html",import.meta.url),"utf8");
 assert.match(html,/connect-src[^"]+https:\/\/malware-ai\.malguard-security\.workers\.dev/);
 assert.match(html,/\.\/app\.js\?v=device-check-20261030/);
 const script=readFileSync(new URL("../../../ai/app.js",import.meta.url),"utf8");
 assert.match(script,/callCFModel\(/);
 assert.match(script,/mode==='worker'\?'cf_qwen3':selected/);
});

test('client accepts previously offered models without leaking session into URLs',async()=>{
 const legacy=[['chat','cf_llama3b'],['work','cf_gptoss20'],['code','cf_qwen_coder']];
 for(const [mode,model] of legacy){
  const generated=await callCFModel({mode,model,message:'hello',sessionToken:'synthetic-session-valid-user',quotaEnabled:true,fetchImpl:async(url,opt)=>{
   assert.ok(!url.includes('synthetic-session'));
   assert.equal(opt.headers.Authorization,'Bearer synthetic-session-valid-user');
   return Response.json({text:'answer',model:'@cf/example',provider:'workers_ai',modelId:model,usage:{limitTokens:100000,remainingTokens:99880,usedTokens:120,estimated:true}});
  }});
  assert.equal(generated.selectedModel,model);
  assert.equal(generated.usage.remainingTokens,99880);
 }
});

test('old deployed Worker remains supported until it advertises account quotas',async()=>{
 const models=await fetchCFModels({fetchImpl:async()=>Response.json({models:[{id:'chat_granite',mode:'chat',label:'Granite',provider:'workers_ai',available:true}]})});
 assert.equal(models.accountQuotaEnabled,false);
 const got=await callCFModel({mode:'chat',model:'chat_granite',message:'hello',quotaEnabled:models.accountQuotaEnabled,fetchImpl:async(_,options)=>{
  assert.equal(options.headers.Authorization,undefined,'do not send an Authorization preflight to the old Worker');
  return Response.json({text:'Legacy result',provider:'workers_ai',model:'@cf/ibm-granite/granite-4.0-h-micro',modelId:'chat_granite'});
 }});
 assert.equal(got.text,'Legacy result');
});

test('account usage is read only with an authenticated session and strict numeric validation',async()=>{
 let calls=0;
 const usage=await fetchCFUsage({sessionToken:'synthetic-session-valid-user',fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://malware-ai.malguard-security.workers.dev/api/account-usage');
  assert.equal(options.headers.Authorization,'Bearer synthetic-session-valid-user');
  return Response.json({limitTokens:100000,remainingTokens:98000,usedTokens:2000,resetAt:'2026-11-01T00:00:00.000Z'});
 }});
 assert.equal(calls,1);assert.equal(usage.remainingTokens,98000);assert.equal(usage.estimated,true);
 await assert.rejects(fetchCFUsage({sessionToken:'',fetchImpl:async()=>{throw Error('should not fetch');}}),/sign_in_required/);
 await assert.rejects(fetchCFUsage({sessionToken:'synthetic-session-valid-user',fetchImpl:async()=>Response.json({limitTokens:100000,remainingTokens:200000,usedTokens:0,resetAt:'2026-11-01T00:00:00.000Z'})}),/invalid_usage/);
});

test('a stale or incomplete backend never hides classic models or wrongly enables them',async()=>{
 const partial=await fetchCFModels({fetchImpl:async()=>Response.json({models:[{id:'chat_granite',mode:'chat',label:'Granite',provider:'workers_ai',available:true}]})});
 assert.equal(partial.length,22);
 assert.equal(partial.find(m=>m.id==='chat_granite').available,true);
 for(const id of ['cf_gptoss120','llama70b','cf_qwen_coder','groq_qwen']){
  assert.equal(partial.find(m=>m.id===id).available,false,id);
 }
 const invalid=await fetchCFModels({fetchImpl:async()=>Response.json({models:[
  {id:'chat_granite',mode:'code',label:'Incorrect mode',provider:'workers_ai',available:true},
  {id:'cf_gptoss120',mode:'code',label:'Incorrect provider',provider:'wrong',available:true},
 ]})});
 assert.equal(invalid.filter(m=>m.available).length,0);
 const offline=unavailableCFModels();
 assert.equal(offline.length,22);
 assert.ok(offline.every(m=>m.available===false));
});
