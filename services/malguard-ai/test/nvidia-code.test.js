import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRequest,InputError} from '../server/contracts.js';
import {createOrchestrator} from '../server/orchestrator.js';
import {planCloudChat} from '../../../ai/routing.mjs';

const ID='nvidia_nemotron_ultra';
const OPENROUTER='openrouter_nemotron_ultra';
test('NVIDIA model is an explicit allowlisted ID, not a user-supplied endpoint',()=>{
 const base={mode:'chat',message:'Create a website',consent:{modelShare:true}};
 assert.equal(parseRequest({...base,model:ID}).model,ID);
 assert.equal(parseRequest({...base,model:OPENROUTER}).model,OPENROUTER);
 assert.throws(()=>parseRequest({...base,model:'https://integrate.api.nvidia.com/v1'}),InputError);
});

test('Code Auto uses NVIDIA only when the gateway advertises it configured',()=>{
 const models=[
  {id:ID,state:'disabled'}, {id:OPENROUTER,state:'disabled'}, {id:'cf_gptoss120',state:'configured'}
 ];
 const message='Build a simple website with HTML';
 assert.equal(planCloudChat(message,[],{models,mode:'build'}).model,'cf_gptoss120');
 models[1].state='configured';
 assert.equal(planCloudChat(message,[],{models,mode:'build'}).model,OPENROUTER);
 assert.equal(planCloudChat('Write code',[],{models,mode:'build'}).model,OPENROUTER);
 models[0].state='configured';
 assert.equal(planCloudChat(message,[],{models,mode:'build'}).model,OPENROUTER);
});

test('explicit NVIDIA Code request keeps consent, language, and model selection',async()=>{
 let received;
 const m={status:()=>({state:'configured',models:[{id:ID,state:'configured'}]}),respond:async(message,locale,history,id,consent)=>{
  received={message,locale,history,id,consent};
  return {text:'<summary>Example project</summary>',provider:'nvidia',model:'nvidia/nemotron-3-ultra-550b-a55b',selectedModel:ID,securityAnalysis:false};
 }};
 const service=createOrchestrator({},m);
 await assert.rejects(service.run({mode:'chat',message:'Build an interface',model:ID,consent:{modelShare:false}}),{code:'model_consent_required'});
 const output=await service.run({mode:'chat',message:'یک صفحه بساز',model:ID,routingMode:'build',routingText:'یک صفحه بساز',consent:{modelShare:true}});
 assert.equal(output.generated.provider,'nvidia');
 assert.equal(received.id,ID);
 assert.equal(received.locale,'fa');
 assert.equal(received.consent.routingMode,'build');
 assert.equal(output.generated.securityAnalysis,false);
});