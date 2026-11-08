import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchCFModels,callCFModel,CF_DEFAULTS,isNewCloudModel} from '../ai/cloudflare-models.mjs';

const fixtures=[
 {id:'chat_granite',mode:'chat',provider:'workers_ai_rest',available:true,label:'Granite 4 Micro'},
 {id:'chat_think',mode:'chat',provider:'workers_ai_rest',available:true,label:'GPT-OSS 20B · Chat'},
 {id:'chat_flash',mode:'chat',provider:'gemini',available:true,label:'Gemini Lite'},
 {id:'cf_gptoss20',mode:'work',provider:'workers_ai_rest',available:true,label:'GPT-OSS 20B · Work'},
 {id:'cf_qwen3',mode:'work',provider:'workers_ai_rest',available:true,label:'Qwen3.8 27B · Work'},
 {id:'cf_gemma4',mode:'work',provider:'workers_ai_rest',available:true,label:'Gemma 4 26B · Work'},
 {id:'cf_gptoss120',mode:'code',provider:'workers_ai_rest',available:true,label:'GPT-OSS 120B · Code'},
 {id:'code_ultra',mode:'code',provider:'openrouter',available:true,label:'Nemotron Ultra'}
];
function fakeCatalog(){return Response.json({models:fixtures,accountQuota:{enabled:false},thinking:{provider:'workers_ai_rest',byMode:{chat:true,work:true,code:true}}});}
test('new models appear only within their designated Chat, Work or Code mode',async()=>{
 const models=await fetchCFModels({fetchImpl:async()=>fakeCatalog()});
 const chat=models.filter(m=>m.available&&m.mode==='chat').map(m=>m.id);
 const work=models.filter(m=>m.available&&m.mode==='work').map(m=>m.id);
 const code=models.filter(m=>m.available&&m.mode==='code').map(m=>m.id);
 assert.ok(chat.includes('chat_granite')&&chat.includes('chat_think'));
 assert.ok(work.includes('cf_gptoss20')&&work.includes('cf_qwen3')&&work.includes('cf_gemma4'));
 assert.ok(code.includes('cf_gptoss120'));
 assert.ok(!chat.includes('cf_gptoss120'), 'Code model must never be listed in Chat');
 assert.ok(!work.includes('cf_gptoss120'), 'Code model must never be listed in Work');
 assert.deepEqual(models.thinkingByMode,{chat:true,work:true,code:true});
 for(const id of ['chat_granite','chat_think','cf_gptoss20','cf_qwen3','cf_gemma4','cf_gptoss120'])assert.equal(isNewCloudModel(id),true);
 assert.deepEqual(CF_DEFAULTS,{chat:'chat_auto',work:'work_auto',code:'code_auto'});
});
test('browser rejects cross-mode model requests without contacting the network',async()=>{
 let networkCalls=0;
 for(const [mode,model] of [['chat','cf_gptoss120'],['work','cf_gptoss120'],['code','chat_think']]){
  await assert.rejects(callCFModel({mode,model,message:'Hello',sessionToken:'synthetic-session-id',fetchImpl:async()=>{networkCalls++;throw Error('unexpected network')}}),/invalid_model_request/);
 }
 assert.equal(networkCalls,0);
});
test('Thinking is opt-in and included in chat requests only when explicitly enabled',async()=>{
 const requests=[];
 const fetchImpl=async(url,o)=>{
  const body=JSON.parse(o.body);requests.push(body);
  return Response.json({text:'OK',model:'@cf/openai/gpt-oss-20b',modelId:body.model,provider:'workers_ai_rest',thinking:body.thinking===true,thinkingModelId:body.thinking?'chat_think':undefined});
 };
 const args={mode:'chat',model:'chat_granite',message:'Hello',history:[],sessionToken:'synthetic-session-id',fetchImpl};
 const normal=await callCFModel(args);
 const deep=await callCFModel({...args,thinking:true});
 assert.equal(requests.length,2);
 assert.equal(requests[0].thinking,undefined);
 assert.equal(requests[1].thinking,true);
 assert.equal(normal.thinkingUsed,false);
 assert.equal(deep.thinkingUsed,true);
 assert.equal(deep.thinkingModelId,'chat_think');
});
test('site contains a real Thinking button and mode-filtered selector',()=>{
 const app=readFileSync(new URL('../ai/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../ai/index.html',import.meta.url),'utf8');
 assert.match(html,/id="thinking-toggle"/);
 assert.match(app,/cfModels\.filter\(m=>m\.available&&m\.mode===cfMode\)/);
 assert.match(app,/DESKTOP_MODEL_MODES/);
 assert.match(app,/cfThinkingByMode\[cfMode\]/);
 assert.match(app,/thinkingEnabled=false; \/\/ Explicit opt-in per mode/);
 assert.match(app,/isNewCloudModel\(m\.id\)/);
 assert.doesNotMatch(html,/<select id="workspace-model"[^>]*>[^<]*<option[^>]*value="cf_gptoss120"/);
});
