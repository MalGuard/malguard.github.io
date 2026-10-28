import test from 'node:test';
import assert from 'node:assert/strict';
import {localCapability,localCapabilityDetails,createLocalChat,localMessages,localModels,localAppConfig,clearLocalModelCache} from '../../../ai/local-models.mjs';
import {planChat} from '../../../ai/routing.mjs';
import {createOrchestrator} from '../server/orchestrator.js';

test('light and strong models have pinned assets and disclose download and GPU requirements',()=>{
 assert.equal(localModels.local_fast.model,'Qwen3-1.7B-q4f16_1-MLC');
 assert.equal(localModels.local_medium.model,'Qwen3-4B-q4f16_1-MLC');
 assert.ok(localModels.local_medium.downloadMB>2000);
 assert.ok(localModels.local_medium.gpuMB>localModels.local_fast.gpuMB);
 for(const m of Object.values(localModels)){
  assert.match(m.revision,/^[a-f0-9]{40}$/);
  const config=localAppConfig.model_list.find(c=>c.model_id===m.model);
  assert.ok(config.model.includes(m.revision));
  assert.ok(config.model_lib.endsWith(`${m.model.replace('-MLC','')}_cs1k-webgpu.wasm`));
 }
});

test('removing downloaded models also clears the retired 0.6B cache after upgrade',async()=>{
 const removed=[];
 await clearLocalModelCache(async(id,config)=>{assert.ok(config.model_list.some(m=>m.model_id===id));removed.push(id);});
 assert.deepEqual(removed.sort(),['Qwen3-0.6B-q4f16_1-MLC','Qwen3-1.7B-q4f16_1-MLC','Qwen3-4B-q4f16_1-MLC']);
 assert.equal(Object.keys(localModels).length,2,'Retired models must not become selectable');
});
test('four tiers recognize Persian/English requests and preserve research follow-ups',()=>{
 for(const message of ['سلام','سلام خوبی؟','Hello!','Thanks'])assert.equal(planChat(message).tier,'fast');
 assert.equal(planChat('Explain how DNS works').tier,'medium');
 assert.equal(planChat('آخرین اخبار فناوری را با منابع تحقیق کن').tier,'strong');
 assert.equal(planChat('Prove this multi-step mathematical statement').tier,'expert');
 const follow=planChat('ادامه',[{role:'user',content:'تحقیق درباره آخرین اخبار'}]);assert.equal(follow.needsWeb,true);assert.equal(follow.tier,'strong');
 assert.equal(planChat('Prove this result using current sources').needsWeb,true);
});
test('device capability explains missing WebGPU, GPU and required feature without downloading',async()=>{
 const gpu=features=>({requestAdapter:async()=>({features:new Set(features)})});
 assert.deepEqual(await localCapabilityDetails({secure:false,gpu:gpu(['shader-f16'])}),{ready:false,reason:'insecure_context'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:null}),{ready:false,reason:'webgpu_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:{requestAdapter:async()=>null}}),{ready:false,reason:'adapter_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:gpu([])}),{ready:false,reason:'shader_f16_unavailable'});
 assert.deepEqual(await localCapabilityDetails({secure:true,gpu:gpu(['shader-f16'])}),{ready:true,reason:'ready'});
});
test('unsupported devices fail capability checks without creating an engine or downloading weights',async()=>{
 assert.equal(await localCapability(undefined),false);
});
test('explicit model preparation downloads only a validated model and carries no conversation',async()=>{
 const calls=[];let worker;
 const chat=createLocalChat({workerFactory:()=>worker={postMessage:payload=>calls.push(payload),terminate(){}}});
 await assert.rejects(chat.prepare('untrusted-model'),/invalid_local_model/);assert.equal(calls.length,0);
 const progress=[],ready=chat.prepare('local_medium',value=>progress.push(value));
 assert.deepEqual(calls,[{operation:'prepare',model:'local_medium'}]);
 worker.onmessage({data:{progress:40}});worker.onmessage({data:{prepared:true}});
 assert.equal(await ready,true);assert.deepEqual(progress,[40]);chat.stop();
});
test('local work stays in a worker, allows cancellation and preserves response metadata',async()=>{
 const workers=[],progress=[],phases=[];
 const chat=createLocalChat({workerFactory:()=>{const w={terminated:false,postMessage(payload){this.payload=payload;},terminate(){this.terminated=true;}};workers.push(w);return w;}});
 await assert.rejects(chat.respond({model:'arbitrary',message:'hello'}),/invalid_local_model/);assert.equal(workers.length,0);
 const first=chat.respond({model:'local_fast',message:'سلام',locale:'fa',history:[]},p=>progress.push(p),()=>phases.push('thinking'));
 assert.equal(workers[0].payload.model,'local_fast');assert.match(workers[0].payload.messages[0].content,/فارسی/);
 workers[0].onmessage({data:{progress:25}});assert.deepEqual(progress,[25]);
 workers[0].onmessage({data:{phase:'model_started'}});assert.deepEqual(phases,['thinking']);assert.deepEqual(progress,[25]);
 workers[0].onmessage({data:{generated:{text:'سلام',provider:'on_device'}}});assert.equal((await first).provider,'on_device');
 const second=chat.respond({model:'local_medium',message:'Explain DNS',locale:'en',history:[]},p=>progress.push(p*2));
 workers[0].onmessage({data:{progress:30}});assert.deepEqual(progress,[25,60]);chat.stop();await assert.rejects(second,/local_cancelled/);assert.equal(workers[0].terminated,true);
});
test('local input is bounded and timeout releases worker resources without a cloud fallback',async()=>{
 let terminated=0;
 const chat=createLocalChat({timeout:5,workerFactory:()=>({postMessage(){},terminate(){terminated++;}})});
 await assert.rejects(chat.respond({model:'local_fast',message:'a'.repeat(1201),history:[]}),/local_input_too_long/);
 await assert.rejects(chat.respond({model:'local_fast',message:'Hello',locale:'en',history:[]}),/local_cancelled/);assert.equal(terminated,1);
 const messages=localMessages('Hello','en',Array.from({length:8},()=>({role:'user',content:'a'.repeat(500)})));assert.equal(messages.length,4);assert.equal(messages[1].content.length,100);
});
test('automatic research checks lookup and model consent before emitting events or calling providers',async()=>{
 let calls=0,events=0;
 const o=createOrchestrator({},{status:()=>({state:'configured'}),respond:async()=>{calls++;return {text:'fixture'};}});
 await assert.rejects(o.run({message:'Search current sources',model:'auto',consent:{modelShare:true}},()=>events++),/lookup_consent_required/);
 assert.equal(calls,0);assert.equal(events,0);
 const result=await o.run({message:'Search current sources',model:'auto',consent:{modelShare:true,remoteLookup:true}});assert.equal(result.generated.text,'fixture');assert.equal(calls,1);
});
