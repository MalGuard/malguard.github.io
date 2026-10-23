import test from 'node:test';
import assert from 'node:assert/strict';
import {replyLanguage} from '../server/language.js';
import {createOrchestrator} from '../server/orchestrator.js';
import {parseRequest} from '../server/contracts.js';
test('Persian and English messages choose their own response language, independently of the interface',()=>{
 assert.equal(replyLanguage('سلام','en'),'fa');assert.equal(replyLanguage('Hello','fa'),'en');
 assert.equal(replyLanguage('Explain DNS به فارسی','en'),'fa');assert.equal(replyLanguage('سلام، به انگلیسی جواب بده','fa'),'en');
 assert.equal(replyLanguage('👍','en',[{role:'user',content:'سلام'}]),'fa');
});
test('orchestrator preserves English UI locale while requesting a Persian answer and the selected model',async()=>{
 const o=createOrchestrator({},{status:()=>({state:'configured'}),respond:async(message,locale,history,model)=>{assert.equal(message,'سلام');assert.equal(locale,'fa');assert.equal(model,'llama70b');return {text:'سلام!'};}});
 const r=await o.run({message:'سلام',locale:'en',model:'llama70b',consent:{modelShare:true}});assert.equal(r.locale,'en');assert.equal(r.generated.text,'سلام!');
});
test('arbitrary model names, endpoints and non-string selectors are rejected before provider access',()=>{
 for(const model of ['https://attacker.example','paid_model',null,{},1])assert.throws(()=>parseRequest({message:'hello',model}));
 assert.equal(parseRequest({message:'hello'}).model,'llama70b');
 assert.equal(parseRequest({message:'hello',model:'gemini_flash'}).model,'gemini_flash');
 assert.equal(parseRequest({message:'hello',model:'groq_gptoss'}).model,'groq_gptoss');
});
