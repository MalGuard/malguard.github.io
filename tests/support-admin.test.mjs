import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportAdmin} from '../services/support/server/support-admin.mjs';
const email='owner@example.test', accountId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correct={verified:true,method:'account',email,accountId};
const start=Date.parse('2026-11-20T12:00:00.000Z');
const make=()=>{
 let current=start,challenge=null,used=false,attempts=0,code=null;
 const store={enabled:true,issueAdminChallenge:async(mail,hash)=>{
   assert.equal(mail,email);challenge={hash};return 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 },redeemAdminChallenge:async(_id,mail,hash)=>{
   if(used||!challenge||mail!==email||++attempts>5)return false;
   if(hash===challenge.hash){used=true;return true;}return false;
 }};
 const mailer={enabled:true,sendAdminCode:async({email:to,code:otp})=>{assert.equal(to,email);code=otp;return true;}};
 const admin=createSupportAdmin({store,mailer,email,secret:'s'.repeat(64),now:()=>current});
 return {admin,setTime:t=>current=t,getCode:()=>code};
};
test('owner-only dual factor denies spoofed admin and other accounts',async()=>{
 const f=make();
 await assert.rejects(f.admin.requestCode({...correct,email:'other@example.test'}),e=>e.status===403);
 await assert.rejects(f.admin.requestCode({...correct,verified:false}),e=>e.status===403);
 await assert.rejects(f.admin.requestCode({...correct,method:'admin'}),e=>e.status===403);
 await assert.rejects(f.admin.requestCode({...correct,role:'support-admin',accountId:null}),e=>e.status===403);
 const challenge=await f.admin.requestCode(correct);
 assert.match(challenge.challengeId,/^[a-f0-9-]{36}$/);
 assert.match(f.getCode(),/^[0-9]{8}$/);
});
test('owner step-up grants 15-minute signed session, rejects replay and tampering',async()=>{
 const f=make();const challenge=await f.admin.requestCode(correct);
 await assert.rejects(f.admin.verifyCode(correct,challenge.challengeId,'111111111'),e=>e.status===401);
 const token=(await f.admin.verifyCode(correct,challenge.challengeId,f.getCode())).accessToken;
 const actor=f.admin.actorFromToken(token);
 assert.equal(actor.permission,'support:manage');
 assert.equal(actor.method,'admin');
 await assert.rejects(f.admin.verifyCode(correct,challenge.challengeId,f.getCode()),e=>e.status===401);
 assert.throws(()=>f.admin.actorFromToken(token.slice(0,-3)+'abc'),e=>e.status===401);
 f.setTime(start+15*60000);
 assert.throws(()=>f.admin.actorFromToken(token),e=>e.status===401);
});
test('admin feature stays disabled unless owner identity and keys are configured',()=>{
 const admin=createSupportAdmin({email:'',secret:null,store:{enabled:true},mailer:{enabled:true}});
 assert.equal(admin.enabled,false);
 assert.throws(()=>admin.actorFromToken('invalid'),e=>e.status===503);
});
