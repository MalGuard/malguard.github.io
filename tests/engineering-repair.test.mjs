import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {safeDebugReport,createRepairAnalyzer} from '../tools/engineering-staging/repair.mjs';
const event=()=>({requestId:randomUUID(),endpoint:'/chat',statusCode:503,errorCode:'provider_timeout',durationMs:100,provider:'workers_ai_rest',model:'cf_qwen3',message:'PRIVATE_MESSAGE',authorization:'PRIVATE_TOKEN',url:'https://private.example'});
test('safe reports exclude every arbitrary field and cap event count',()=>{
 const report=safeDebugReport(Array.from({length:30},event));assert.equal(report.events.length,10);assert.equal(safeDebugReport([{...event(),errorCode:'none',statusCode:200}]).events[0].errorCode,'none');assert.ok(!JSON.stringify(report).includes('PRIVATE'));assert.ok(!JSON.stringify(report).includes('private.example'));
});
test('two fixed models analyze/review bounded metadata without executing code',async()=>{
 const calls=[],analyzer=createRepairAnalyzer({enabled:true,fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return Response.json({generated:{text:'تشخیص آزمایشی؛ نیازمند بررسی انسانی',selectedModel:body.model,provider:'workers_ai_rest'}});}});
 const result=await analyzer.analyze([event()]);assert.equal(result.state,'MANUAL_REVIEW');assert.equal(result.reviewed,true);assert.deepEqual(calls.map(c=>c.body.model),['cf_qwen3','cf_gptoss120']);assert.ok(!JSON.stringify(calls).includes('PRIVATE'));assert.ok(calls.every(c=>c.url==='https://malware-ai-gray.vercel.app/api/malguard-assistant'));
});
test('disabled/unavailable models and malformed responses remain manual review',async()=>{
 let calls=0;const disabled=createRepairAnalyzer({fetchImpl:async()=>{calls++;}});assert.equal((await disabled.analyze([event()])).state,'MANUAL_REVIEW');assert.equal(calls,0);
 const broken=createRepairAnalyzer({enabled:true,fetchImpl:async()=>Response.json({generated:{text:'untrusted',selectedModel:'paid-model',provider:'unknown'}})});const result=await broken.analyze([event()]);assert.equal(result.state,'MANUAL_REVIEW');assert.equal(result.reviewed,false);assert.equal(result.reason,'model_unavailable');
});
test('concurrent jobs and lifetime request budgets cannot multiply model calls',async()=>{
 let release,calls=0;const analyzer=createRepairAnalyzer({enabled:true,maxCalls:2,fetchImpl:async(_url,options)=>{calls++;if(calls===1)await new Promise(r=>release=r);const body=JSON.parse(options.body);return Response.json({generated:{text:'safe analysis',provider:'workers_ai_rest',selectedModel:body.model}});}});
 const pending=analyzer.analyze([event()]);await new Promise(setImmediate);const busy=await analyzer.analyze([event()]);assert.equal(busy.reason,'busy');release();await pending;const quota=await analyzer.analyze([event()]);assert.equal(quota.reason,'budget_exhausted');assert.equal(calls,2);
});
