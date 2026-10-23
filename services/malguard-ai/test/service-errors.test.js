import test from 'node:test';
import assert from 'node:assert/strict';
import {httpFailure,publicFailure,retryDetails,ServiceError} from '../../../ai/service-errors.mjs';
import {errorMessage} from '../../../ai/error-message.mjs';
import {gatewayRequest} from '../server/provider-gateway.js';
import {createOrchestrator} from '../server/orchestrator.js';
import {createApp} from '../server/app.js';
const now=Date.UTC(2026,9,23,18),reset=new Date(now+90000).toISOString();
test('Retry-After accepts seconds and HTTP dates but never invents missing or invalid reset times',()=>{
 assert.deepEqual(retryDetails('90',now),{retryAfterSeconds:90,retryAt:reset});
 assert.deepEqual(retryDetails(new Date(now+90000).toUTCString(),now),{retryAfterSeconds:90,retryAt:reset});
 for(const v of [null,'','-1','tomorrow','Infinity','99999999999999999999','Wed, 01 Jan 2020 00:00:00 GMT'])assert.deepEqual(retryDetails(v,now),{});
});
test('provider failures distinguish rate, quota, credit, credentials and outage; discard sensitive messages',()=>{
 for(const [status,body,expected]of [[429,{},'provider_rate_limited'],[429,{error:{code:'insufficient_quota',message:'private-secret'}},'provider_quota_exhausted'],[402,{},'provider_billing_required'],[401,{},'provider_auth_failed'],[503,{},'provider_unavailable']]){
  const f=publicFailure(httpFailure(status,{'retry-after':'90'},body,now));assert.equal(f.error,expected);assert.equal(f.retryAt,reset);assert.ok(!JSON.stringify(f).includes('private-secret'));
 }
 const f=publicFailure(httpFailure(429,{}, {error:{details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'1.5s'}]}},now));assert.equal(f.retryAfterSeconds,2);
 assert.equal(publicFailure(new Error('private-secret')).error,'provider_unavailable');
});
test('gateway -> orchestrator -> HTTP stream preserves the exact safe reset metadata',async t=>{
 const orchestrator=createOrchestrator({},{status:()=>({state:'configured'}),respond:()=>gatewayRequest({}, {transport:async()=>({status:429,headers:{},bytes:Buffer.from(JSON.stringify({error:'provider_quota_exhausted',retryAt:reset,retryAfterSeconds:90,message:'private-secret'}))})})});
 const server=createApp({orchestrator,log:()=>{}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
 const r=await fetch(`http://127.0.0.1:${server.address().port}/chat`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({message:'hello',consent:{modelShare:true}})});
 const raw=await r.text(),terminal=JSON.parse(raw.trim().split('\n').at(-1)).result;
 assert.equal(terminal.error,'provider_quota_exhausted');assert.equal(terminal.retryAt,reset);assert.ok(!raw.includes('private-secret'));assert.equal(terminal.generated,undefined);
});
test('search failures retain safe provider timing on the security result without a safety conclusion',async()=>{
 const o=createOrchestrator({ai_web:{status:()=>({state:'configured'}),run:async()=>{throw new ServiceError('provider_rate_limited',429,{retryAt:reset,retryAfterSeconds:90});}}},{status:()=>({state:'disabled'})});
 const r=await o.run({tool:'ai_web',message:'benign',consent:{remoteLookup:true}});assert.equal(r.result.outcome,'error');assert.equal(r.result.failure.retryAt,reset);
});
test('local rate window reports its actual remaining time, independent of browser timezone',async t=>{
 let clock=now;const server=createApp({now:()=>clock,log:()=>{},orchestrator:{run:async()=>({message:'fixture'})}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
 const send=()=>fetch(`http://127.0.0.1:${server.address().port}/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 for(let i=0;i<10;i++)await send();clock+=45000;const r=await send();assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'15');assert.equal((await r.json()).retryAt,new Date(now+60000).toISOString());
 clock+=15001;assert.equal((await send()).status,200);
});
test('Persian and English messages show a timezone-labelled real time or explicitly unknown time',()=>{
 const f={error:'provider_rate_limited',retryAt:reset};
 const fa=errorMessage(f,'fa',{now,timeZone:'Asia/Tehran'});assert.match(fa,/لیمیت/);assert.match(fa,/۲۱:۳۱:۳۰/);assert.match(fa,/زمان اعلام‌شده/);
 const en=errorMessage(f,'en',{now,timeZone:'UTC'});assert.match(en,/18:01:30/);
 assert.match(errorMessage({error:'provider_quota_exhausted'},'fa'),/زمان رفع محدودیت.*اعلام نشده/);
 assert.match(errorMessage({error:'provider_billing_required'},'en'),/credit or billing/);
 assert.match(errorMessage(f,'fa',{now:now+100000,timeZone:'UTC'}),/اکنون می‌توانید/);
});
