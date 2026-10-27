import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportResponder} from '../tools/engineering-staging/support.mjs';
const input={description:'هنگام ارسال پیام صفحه متوقف می‌شود و پاسخ دریافت نمی‌کنم.',steps:'صفحه را باز کردم و پیام فرستادم.',consent:true};
test('support requires consent, rejects malformed input and sends only bounded redacted report',async()=>{
 const sent=[];const service=createSupportResponder({enabled:true,fetchImpl:async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({generated:{provider:'workers_ai_rest',selectedModel:'cf_qwen3',text:'لطفاً صفحه را تازه‌سازی کنید؛ هنوز علت تأیید نشده است.'}});}});
 await assert.rejects(service.submit({...input,consent:false}));await assert.rejects(service.submit({...input,description:'x'.repeat(2001)}));assert.equal(sent.length,0);
 const result=await service.submit({...input,description:input.description+' user@example.com Bearer abcdefghijklmnop password=private123'});
 assert.equal(result.state,'REPLIED');assert.match(result.reportId,/^[a-f0-9-]{36}$/);assert.equal(result.resolved,false);assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('user@example.com'));assert.ok(!JSON.stringify(sent).includes('private123'));assert.ok(!JSON.stringify(sent).includes('abcdefghijklmnop'));
});
test('outages, disabled connection, concurrency and exhausted budget never claim a reply or fix',async()=>{
 const disabled=createSupportResponder();assert.equal((await disabled.submit(input)).state,'MANUAL_REVIEW');
 let release;const responder=createSupportResponder({enabled:true,maxCalls:1,fetchImpl:async()=>{await new Promise(r=>release=r);return Response.json({generated:{provider:'unknown',selectedModel:'cf_qwen3',text:'fixed'}});}});
 const pending=responder.submit(input);assert.equal((await responder.submit(input)).reason,'busy');release();assert.equal((await pending).reason,'model_unavailable');assert.equal((await responder.submit(input)).reason,'budget_exhausted');
});

test('model claims of completed fixes are not presented as support replies',async()=>{const service=createSupportResponder({enabled:true,fetchImpl:async()=>Response.json({generated:{provider:'workers_ai_rest',selectedModel:'cf_qwen3',text:'مشکل را حل کردم. fixed'}})});const result=await service.submit(input);assert.equal(result.state,'MANUAL_REVIEW');assert.equal(result.reply,'');assert.equal(result.reason,'unsafe_model_response');});
