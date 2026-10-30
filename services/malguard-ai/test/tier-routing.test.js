import test from 'node:test';
import assert from 'node:assert/strict';
import {planCloudChat,cloudRoutedModels,cloudModelOffered} from '../../../ai/routing.mjs';
const models=(...ids)=>ids.map(id=>({id,state:'configured'}));
test('five task tiers select the first configured model without changing providers implicitly',()=>{
 const available=models('cf_llama3b','cf_qwen3','cf_gptoss20','cf_qwen_coder','cf_gptoss120');
 for(const [message,options,tier,model] of [
  ['سلام',{},'fast','cf_llama3b'],['translate cat',{},'fast','cf_llama3b'],
  ['Find latest news',{},'search','cf_qwen3'],['Make an HTML page',{mode:'build'},'build','cf_gptoss120'],
  ['دیباگ کد پایتون',{},'coding','cf_qwen_coder'],['Prove this theorem',{},'expert','cf_gptoss120'],
  ['Explain DNS resolution',{},'medium','cf_gptoss20']]){
  const p=planCloudChat(message,[],{...options,models:available});assert.equal(p.tier,tier,message);assert.equal(p.model,model,message);
 }
 assert.ok(cloudRoutedModels.includes('cf_llama3b'));
});
test('unconfigured preferred models are skipped and no candidate is reported as unavailable',()=>{
 const p=planCloudChat('سلام',[],{models:models('cf_qwen3')});assert.equal(p.model,'cf_qwen3');
 const no=planCloudChat('سلام',[],{models:[{id:'cf_glm',state:'disabled'}]});assert.equal(no.model,null);
 assert.equal(planCloudChat('latest news',[],{models:models('gemini_flash','cf_qwen3')}).model,'gemini_flash');
});
test('configured Gemini and Groq models stay routable when a free-tier flag is also present',()=>{
 const flagged=[
  {id:'gemini_flash',state:'configured',reason:'free_tier_not_confirmed'},
  {id:'groq_qwen',state:'configured',reason:'free_tier_not_confirmed'},
  {id:'groq_gptoss',state:'configured',reason:'free_tier_not_confirmed'},
  {id:'cf_qwen3',state:'configured'}
 ];
 assert.equal(planCloudChat('latest sources',[],{models:flagged}).model,'gemini_flash');
 assert.equal(planCloudChat('build a website preview',[],{models:flagged,mode:'build'}).model,'groq_qwen');
 assert.equal(planCloudChat('debug this function',[],{models:flagged}).model,'groq_gptoss');
 for(const model of flagged.slice(0,3))assert.equal(cloudModelOffered(model),true,model.id);
 assert.equal(cloudModelOffered({id:'gemini_flash',state:'disabled',reason:'free_tier_not_confirmed'}),false);
 assert.equal(cloudModelOffered({id:'cf_qwen3',state:'disabled',reason:'free_tier_not_confirmed'}),false);
 assert.equal(planCloudChat('latest sources',[],{models:[{id:'gemini_flash',state:'disabled',reason:'free_tier_not_confirmed'},{id:'cf_qwen3',state:'configured'}]}).model,'cf_qwen3');
});

