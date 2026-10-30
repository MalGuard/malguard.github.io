import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CF_DEFAULTS,fetchCFModels,callCFModel} from "../../../ai/cloudflare-models.mjs";

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
 const got=await fetchCFModels({fetchImpl});assert.deepEqual(got,models);
 assert.deepEqual(CF_DEFAULTS,{chat:"chat_granite",work:"work_qwen",code:"code_ultra"});
});
test("chat/work/code send only to Cloudflare worker without API secrets",async()=>{
 for(const [mode,model] of [["chat","chat_granite"],["work","work_qwen"],["code","code_ultra"]]){
  let count=0;
  const result=await callCFModel({mode,model,message:"hello",sessionToken:"synthetic-session-valid-user",history:[{role:"user",content:"prior"}],fetchImpl:async(url,options)=>{
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
test("Cloudflare failure returns code without silently changing to a different host",async()=>{
 await assert.rejects(callCFModel({mode:"chat",model:"chat_granite",message:"hello",sessionToken:"synthetic-session-valid-user",fetchImpl:async()=>Response.json({error:"provider_rate_limited",retryAfterSeconds:47},{status:429})}),e=>e.status===429&&e.code==="provider_rate_limited"&&e.retryAfterSeconds===47);
});
test("existing site styling stays untouched and CSP permits direct Cloudflare",()=>{
 const html=readFileSync(new URL("../../../ai/index.html",import.meta.url),"utf8");
 assert.match(html,/connect-src[^"]+https:\/\/malware-ai\.malguard-security\.workers\.dev/);
 assert.match(html,/\.\/app\.js\?v=quota-accounts-20261030/);
 const script=readFileSync(new URL("../../../ai/app.js",import.meta.url),"utf8");
 assert.match(script,/callCFModel\(/);
 assert.match(script,/mode==='worker'\?'cf_qwen3':selected/);
});

test('client accepts previously offered models without leaking session into URLs',async()=>{
 const legacy=[['chat','cf_llama3b'],['work','cf_gptoss20'],['code','cf_qwen_coder']];
 for(const [mode,model] of legacy){
  const generated=await callCFModel({mode,model,message:'hello',sessionToken:'synthetic-session-valid-user',fetchImpl:async(url,opt)=>{
   assert.ok(!url.includes('synthetic-session'));
   assert.equal(opt.headers.Authorization,'Bearer synthetic-session-valid-user');
   return Response.json({text:'answer',model:'@cf/example',provider:'workers_ai',modelId:model,usage:{limitTokens:100000,remainingTokens:99880,usedTokens:120,estimated:true}});
  }});
  assert.equal(generated.selectedModel,model);
  assert.equal(generated.usage.remainingTokens,99880);
 }
});
