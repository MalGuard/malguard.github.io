import test from 'node:test';
import assert from 'node:assert/strict';
import {planChat,planCloudChat} from '../../../ai/routing.mjs';
test('cloud Auto keeps brief greetings off local downloads and preserves heavy followups',()=>{
 for(const message of ['سلام رفیق','سلان','2+2','What is DNS?'])assert.equal(planCloudChat(message).model,'cf_qwen3');
 assert.equal(planCloudChat('Explain how DNS resolution works').model,'cf_gptoss20');
 assert.equal(planCloudChat('کد پایتون برای مرتب‌سازی سه عدد').model,'cf_gptoss120');
 const follow=planCloudChat('ادامه',[{role:'user',content:'اثبات این مسئله با آخرین منابع'}]);assert.equal(follow.model,'cf_qwen3');assert.equal(follow.tier,'search');assert.equal(follow.needsWeb,true);
 assert.equal(planChat('سلام').model,'local_fast','Explicit local Auto remains separate');
});

