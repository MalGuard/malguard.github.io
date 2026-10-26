import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createChallengeStore} from './challenge-store.js';
test('fixed shared-store RPC routes and strict boolean results',async()=>{
 const calls=[];const store=createChallengeStore({url:'https://synthetic.supabase.co/rest/v1',key:'synthetic-service-role-for-tests',fetchImpl:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return Response.json(true);}});const id=randomUUID(),subject='a'.repeat(64);
 assert.equal(await store.issue({id,subject}),true);assert.equal(await store.attempt({id,matched:false}),true);
 assert.deepEqual(calls,[{url:'https://synthetic.supabase.co/rest/v1/rpc/guard_issue_email_challenge',body:{p_id:id,p_subject:subject}},{url:'https://synthetic.supabase.co/rest/v1/rpc/guard_attempt_email_challenge',body:{p_id:id,p_matched:false}}]);
});
test('missing configuration and malformed input never contact upstream',async()=>{
 let calls=0;const store=createChallengeStore({url:'https://attacker.example',key:'synthetic-service-role-for-tests',fetchImpl:async()=>{calls++;}});
 assert.equal(store.enabled,false);await assert.rejects(()=>store.issue({id:randomUUID(),subject:'a'.repeat(64)}),{status:503});await assert.rejects(()=>store.attempt({id:'../other',matched:true}),{status:503});assert.equal(calls,0);
});
test('upstream errors and invalid or oversized response bodies fail closed',async()=>{
 for(const response of [()=>Response.json({secret:'must not be exposed'},{status:500}),()=>Response.json({accepted:true}),()=>new Response('x'.repeat(17000))]){
  const store=createChallengeStore({url:'https://synthetic.supabase.co',key:'synthetic-service-role-for-tests',fetchImpl:async()=>response()});await assert.rejects(()=>store.attempt({id:randomUUID(),matched:true}),{status:503,message:'Shared authentication protection is unavailable.'});
 }
});
