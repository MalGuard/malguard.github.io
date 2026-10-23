import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../server/model.js';
const env={MALGUARD_AI_MODEL_PROVIDER:'workers_ai',MALGUARD_WORKER_PROXY_TOKEN:'fixture-server-token',MALGUARD_AI_WORKERS_MODE:'fast',MALGUARD_AI_WORKERS_FREE_CONFIRMED:'true',MALGUARD_AI_WORKERS_REVIEWED:'true'};
test('existing Workers AI requires its server credential',async()=>{
 let calls=0;const m=createModel({env:{...env,MALGUARD_WORKER_PROXY_TOKEN:''},transport:async()=>{calls++;}});assert.equal(m.status().state,'disabled');assert.equal(await m.respond('Hello','en'),null);assert.equal(calls,0);
});
test('Workers AI uses the authorized existing endpoint and explicit Llama mode without auto or search',async()=>{
 const m=createModel({env,transport:async(url,o)=>{assert.equal(url,'https://malware-ai.malguard-security.workers.dev/api/chat');assert.equal(o.headers['X-MalGuard-Proxy'],'fixture-server-token');assert.equal(o.noRedirect,true);const d=JSON.parse(o.body);assert.equal(d.model,'fast');assert.equal(d.webSearch,false);assert.equal(d.messages.length,1);return {status:200,bytes:Buffer.from('data: {"provider":"fast","model":"Meta Llama 3.2 3B Instruct"}\n\ndata: {"response":"Hello"}\n\n')};}});
 const r=await m.respond('Hello','en');assert.equal(r.text,'Hello');assert.equal(r.provider,'workers_ai');assert.equal(r.securityAnalysis,false);assert.ok(!JSON.stringify(r).includes('fixture-server-token'));
});
test('Workers AI errors, unexpected provider fallback, missing identity or partial output fail closed',async()=>{
 for(const data of ['data: {"response":"hello"}\n\n','data: {"provider":"gemini","model":"Unexpected"}\n\ndata: {"response":"hello"}\n\n','data: {"error":"private-upstream-detail"}\n\n']){
  const m=createModel({env,transport:async()=>({status:200,bytes:Buffer.from(data)})});await assert.rejects(m.respond('hello','en'));
 }
});
