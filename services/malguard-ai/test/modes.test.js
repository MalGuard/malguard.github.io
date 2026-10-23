import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrchestrator} from '../server/orchestrator.js';
import {report} from '../server/contracts.js';
import {readPermissions,savePermissions,revokePermissions} from '../../../ai/permissions.mjs';
test('Chat supports natural multi-turn replies while inspection mode never calls the conversational model',async()=>{
 let calls=0;const model={status:()=>({state:'configured'}),respond:async(message,locale,history)=>{calls++;assert.equal(history[0].content,'Hello');return {text:'A technical explanation',securityAnalysis:false};}};
 const o=createOrchestrator({},model);
 const chat=await o.run({mode:'chat',message:'Explain a function',history:[{role:'user',content:'Hello'}],consent:{modelShare:true}});assert.equal(chat.generated.text,'A technical explanation');
 const worker=await o.run({mode:'worker',message:'Explain a function'});assert.match(worker.message,/چت/);assert.equal(calls,1);
 const greeting=await o.run({mode:'worker',message:'سلام'});assert.match(greeting.message,/سلام/);assert.equal(calls,1);
});
test('URL auto mode searches and checks existing tools concurrently without trusting external text',async()=>{
 const started=[];let release;const ready=new Promise(r=>release=r);
 const adapter=id=>({status:()=>({state:'configured'}),run:async()=>{started.push(id);if(started.length===3)release();await ready;return report(id,'insufficient');}});
 const o=createOrchestrator({game_scam_guard:adapter('game_scam_guard'),urlhaus:adapter('urlhaus'),ai_web:adapter('ai_web')},{status:()=>({state:'disabled'}),respond:()=>{throw new Error('External content must not reach the model');}});
 const r=await o.run({mode:'chat',message:'https://example.com/',consent:{websiteFetch:true,remoteLookup:true}});assert.equal(r.results.length,3);assert.deepEqual(started,['game_scam_guard','urlhaus','ai_web']);
});
test('file auto mode computes static evidence before looking up only the resulting hash',async()=>{
 const hash='a'.repeat(64),inputs=[];
 const o=createOrchestrator({gta_guard:{status:()=>({state:'available'}),run:async()=>report('gta_guard','no_evidence',{metadata:{sha256:hash}})},malwarebazaar:{status:()=>({state:'configured'}),run:async input=>{inputs.push(input);return report('malwarebazaar','no_evidence');}},ai_web:{status:()=>({state:'configured'}),run:async input=>{inputs.push(input);return report('ai_web','insufficient');}}},{status:()=>({state:'disabled'})});
 const r=await o.run({mode:'worker',input:{file:{name:'private-fixture.txt',base64:'aGk='}},consent:{fileUpload:true,remoteLookup:true}});assert.equal(r.results.length,3);assert.deepEqual(inputs,[{sha256:hash},{query:hash}]);assert.ok(!JSON.stringify(inputs).includes('private-fixture'));
});
test('one-time permissions store only versioned booleans and can be revoked',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 assert.equal(readPermissions(storage).modelShare,false);savePermissions(storage,{modelShare:true,fileUpload:true,message:'must not persist'});assert.equal(readPermissions(storage).modelShare,true);assert.ok(![...values.values()][0].includes('must not persist'));revokePermissions(storage);assert.equal(readPermissions(storage).modelShare,false);
});
