import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {createEmailAuth} from './email-auth.js';

import {challengeFixture} from './test-support/challenge-fixture.mjs';
function setup(store=challengeFixture(),now=Date.now){
 let code;const options={apiKey:'synthetic-mail-key-for-testing-only',fromEmail:'guard@example.com',now,challengeStore:store,accountStore:{enabled:false,status:{}},fetchImpl:async(_url,opts)=>{code=JSON.parse(opts.body).htmlContent.match(/>(\d{6})</)[1];return {ok:true};}};
 return {auth:createEmailAuth(options),other:createEmailAuth(options),code:()=>code};
}
test('shared challenge allows one successful verification across server instances',async()=>{
 const {auth,other,code}=setup();const started=await auth.start({emailAddress:'player@example.com'});
 const results=await Promise.allSettled([auth.verify({...started,code:code()}),other.verify({...started,code:code()})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(()=>other.verify({...started,code:code()}),{status:400});
});
test('failed guesses exhaust the same challenge across instances',async()=>{
 const {auth,other,code}=setup();const started=await auth.start({emailAddress:'player@example.com'});
 for(let i=0;i<5;i++)await assert.rejects(()=>(i%2?other:auth).verify({...started,code:'000000'}),{status:400});
 await assert.rejects(()=>other.verify({...started,code:code()}),{status:400});
});
test('challenge-store outages fail closed before email or session side effects',async()=>{
 let sent=0;const auth=createEmailAuth({apiKey:'synthetic-mail-key-for-testing-only',fromEmail:'guard@example.com',accountStore:{enabled:false,status:{}},challengeStore:{enabled:true,issue:async()=>{throw Error('store down');}},fetchImpl:async()=>{sent++;return {ok:true};}});
 await assert.rejects(()=>auth.start({emailAddress:'player@example.com'}),{status:503});assert.equal(sent,0);
});
test('shared per-email issuance budget applies across server instances',async()=>{
 const {auth,other}=setup();for(let i=0;i<3;i++)await (i%2?other:auth).start({emailAddress:'player@example.com',ip:`198.51.100.${i}`});
 await assert.rejects(()=>other.start({emailAddress:'player@example.com',ip:'203.0.113.1'}),{status:429});
});
test('malformed guesses consume the same bounded attempt budget',async()=>{
 const {auth,code}=setup();const started=await auth.start({emailAddress:'player@example.com'});
 for(const bad of ['',null,{},'１２３４５６','1234567'])await assert.rejects(()=>auth.verify({...started,code:bad}),{status:400});
 await assert.rejects(()=>auth.verify({...started,code:code()}),{status:400});
});
test('expiry boundary rejects even the correct code',async()=>{
 let clock=1000;const {auth,code}=setup(challengeFixture(()=>clock),()=>clock);const started=await auth.start({emailAddress:'player@example.com'});clock+=600000;
 await assert.rejects(()=>auth.verify({...started,code:code()}),{status:400});
});
test('verify-store outage creates no account or session',async()=>{
 const shared=challengeFixture();const {auth,code}=setup({...shared,attempt:async()=>{throw Error('outage');}});const started=await auth.start({emailAddress:'player@example.com'});
 await assert.rejects(()=>auth.verify({...started,code:code()}),{status:503});
});
test('legacy encrypted tickets without ledger identity are rejected',async()=>{
 const {auth}=setup();const key=createHash('sha256').update('gamescam-email-auth-v1\0synthetic-mail-key-for-testing-only').digest(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([cipher.update(JSON.stringify({type:'code',email:'player@example.com',code:Buffer.from(JSON.stringify('123456')).toString('base64url'),expiresAt:Date.now()+600000})),cipher.final()]);
 const token=`${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
 await assert.rejects(()=>auth.verify({verificationToken:token,code:'123456'}),{status:400});
});
test('account-store failure never restores a consumed valid code',async()=>{
 let code,lookups=0;const auth=createEmailAuth({apiKey:'synthetic-mail-key-for-testing-only',fromEmail:'guard@example.com',challengeStore:challengeFixture(),accountStore:{enabled:true,status:{},findByEmail:async()=>{lookups++;throw Object.assign(Error('synthetic account outage'),{status:503});}},fetchImpl:async(_url,opts)=>{code=JSON.parse(opts.body).htmlContent.match(/>(\d{6})</)[1];return {ok:true};}});
 const started=await auth.start({emailAddress:'player@example.com'});await assert.rejects(()=>auth.verify({...started,code}),{status:503});await assert.rejects(()=>auth.verify({...started,code}),{status:400});assert.equal(lookups,1);
});
