import test from 'node:test';
import assert from 'node:assert/strict';
import {planCloudChat,cloudRoutedModels} from '../../../ai/routing.mjs';
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

