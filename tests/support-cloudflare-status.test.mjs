import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {supportHealth,handleSupport} from '../services/support/cloudflare/ticket-api.mjs';

test('Cloudflare Pages tickets fail closed without database activation',async()=>{
 const status=await supportHealth({SUPPORT_TICKETS_ENABLED:'false'});
 assert.equal(status.status,200);
 const body=await status.json();
 assert.equal(body.enabled,false);
 assert.equal(body.reason,'support_backend_not_ready');
 assert.deepEqual(body.checks,{config:false,dbBinding:false,dbSchema:false,accountProvider:false,accountProbe:'not_checked'});
 assert.equal(body.aiEnabled,false);
 assert.equal(body.adminEnabled,false);
 assert.equal(body.guestLinksEnabled,false);
 const req=new Request('https://support-preview.malguard.site/api/support/create',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({kind:'bug',subject:'hello',message:'Some issue to report'})
 });
 const result=await handleSupport({request:req,env:{SUPPORT_TICKETS_ENABLED:'false'}},'create');
 assert.equal(result.status,503);
 assert.ok(!JSON.stringify(await result.json()).includes('Some issue'));
});

test('D1 readiness survives intermittent upstream auth status failures',async()=>{
 const db={prepare:()=>({first:async()=>({total:3})})};
 const env={SUPPORT_DB:db,SUPPORT_TICKETS_ENABLED:'true'};
 const ready=await supportHealth(env,{fetchImpl:async()=>({
   ok:true,json:async()=>({configured:true,persistentAccounts:true})
 })});
 assert.equal((await ready.json()).enabled,true);
 const broken=await supportHealth(env,{fetchImpl:async()=>({
   ok:true,json:async()=>({configured:false,persistentAccounts:true})
 })});
 const degraded=await broken.json();
 assert.equal(degraded.enabled,true);
 assert.equal(degraded.emailCodeEnabled,false);
 assert.equal(degraded.checks.accountProvider,false);
 const offline=await supportHealth(env,{fetchImpl:async()=>{throw Error('temporary provider outage');}});
 assert.equal((await offline.json()).enabled,true);
 const missing=await supportHealth({
   SUPPORT_DB:{prepare:()=>({first:async()=>({total:1})})},
   SUPPORT_TICKETS_ENABLED:'true'
 },{fetchImpl:async()=>{throw Error('provider should not be called');}});
 assert.equal((await missing.json()).enabled,false);
});

test('Cloudflare Pages code routes account tickets same origin only',async()=>{
 const ui=await readFile(new URL('../assets/support-agent.js',import.meta.url),'utf8');
 const health=await readFile(new URL('../functions/api/support/status.js',import.meta.url),'utf8');
 const route=await readFile(new URL('../functions/api/support/[endpoint].js',import.meta.url),'utf8');
 assert.match(ui,/const apiBase='';/);
 assert.match(ui,/const auth=\(endpoint,body\)=>support\('auth\/'\+endpoint,body\);/);
 assert.match(health,/supportHealth/);
 assert.match(route,/handleSupport/);
 assert.doesNotMatch(ui,/const apiBase=[^\n]+https:\/\/api\.malguard\.site/);
});
