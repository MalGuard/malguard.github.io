import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CF_DEFAULTS,fetchCFModels,isNewCloudModel,callCFModel} from '../ai/cloudflare-models.mjs';

test('fast and efficient defaults are part of MalGuard AI, without dropping existing models',()=>{
 assert.deepEqual(CF_DEFAULTS,{chat:'chat_auto',work:'work_auto',code:'code_auto'});
 for(const id of ['chat_granite','cf_gptoss20','cf_gptoss120','cf_qwen3','cf_gemma4'])assert.equal(isNewCloudModel(id),true);
 assert.equal(isNewCloudModel('chat_flash'),false);
});

test('new Cloudflare models are shown only after real server catalog confirms them',async()=>{
 const fixtures=[
  ['chat_granite','chat','Granite 4 Micro · Efficient'],
  ['chat_think','chat','GPT-OSS 20B · Deep Chat'],
  ['cf_gptoss20','work','GPT-OSS 20B · Efficient Work'],
  ['cf_gptoss120','code','GPT-OSS 120B · Strong Code'],
  ['cf_qwen3','work','Qwen3.8 27B · Multimodal Work'],
  ['cf_gemma4','work','Gemma 4 26B · Balanced Work']
 ];
 const models=await fetchCFModels({fetchImpl:async()=>Response.json({models:fixtures.map(([id,mode,label])=>({id,mode,label,provider:'workers_ai_rest',available:true})),thinking:{available:true,provider:'workers_ai_rest',byMode:{chat:true,work:true,code:true}},accountQuota:{enabled:false}})});
 assert.equal(models.filter(m=>m.available).length,6);
 assert.ok(models.filter(m=>m.available).every(m=>isNewCloudModel(m.id)));
 assert.equal(models.thinkingAvailable,true);
 assert.deepEqual(models.thinkingByMode,{chat:true,work:true,code:true});
 assert.equal(models.find(m=>m.id==='cf_gptoss120').mode,'code');
 assert.equal(models.find(m=>m.id==='chat_think').mode,'chat');
 assert.equal(models.find(m=>m.id==='chat_flash').available,false);
 const unconfigured=await fetchCFModels({fetchImpl:async()=>Response.json({models:[],thinking:{available:false}})});
 assert.equal(unconfigured.some(m=>m.available),false);
 assert.equal(unconfigured.thinkingAvailable,false);
});

test('Thinking is boolean, per-request and never automatically enabled in the browser',async()=>{
 const sent=[];
 const fetchImpl=async(url,options)=>{
  assert.equal(String(url),'https://models.malguard.site/api/public-model-chat');
  assert.equal(options.headers.Authorization,'Bearer synthetic-session-for-tests');
  sent.push(JSON.parse(options.body));
  return Response.json({text:'Safe output',model:'@cf/openai/gpt-oss-120b',provider:'workers_ai_rest',modelId:options?.thinking?'x':'chat_granite',thinking:sent.at(-1).thinking===true});
 };
 const common={mode:'chat',model:'chat_granite',message:'سلام',history:[],sessionToken:'synthetic-session-for-tests',fetchImpl};
 const quick=await callCFModel(common);
 assert.equal(quick.thinkingUsed,false);
 assert.equal('thinking' in sent[0],false);
 const deep=await callCFModel({...common,thinking:true});
 assert.equal(deep.thinkingUsed,true);
 assert.equal(sent[1].thinking,true);
 assert.equal(sent[1].model,'chat_granite');
 await assert.rejects(callCFModel({...common,thinking:'yes'}),/invalid_model_request/);
 assert.equal(sent.length,2);
});

test('Thinking button is keyboard accessible, defaults off and links to a real request field',async()=>{
 const html=await readFile(new URL('../ai/index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../ai/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../ai/style.css',import.meta.url),'utf8');
 assert.match(html,/id="thinking-toggle"[^>]*aria-pressed="false"/);
 assert.match(html,/data-i18n="thinkingToggle"/);
 assert.match(app,/thinking:thinkingEnabled/g);
 assert.match(app,/thinkingEnabled=!thinkingEnabled/);
 assert.match(app,/cfThinkingByMode\[cfMode\]/);
 assert.match(app,/DESKTOP_MODEL_MODES/);
 assert.match(app,/thinkingEnabled=false; \/\/ Explicit opt-in per mode/);
 assert.match(app,/isNewCloudModel\(m\.id\)/);
 assert.match(app,/search-auto-20261108/);
 assert.match(css,/thinking-toggle:focus-visible/);
 assert.match(css,/model-status\[data-new=true\]/);
});
