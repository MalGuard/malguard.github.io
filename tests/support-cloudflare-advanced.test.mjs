import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAdvancedSupport,checkSupportAdmin,supportAdvancedHealth} from '../services/support/cloudflare/advanced.mjs';
const ticket='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reporter={email:'reporter@example.test'};
const owner={email:'contact@malguard.site'};
const request=new Request('https://support-preview.malguard.site/api/support/agent',{method:'POST'});
function fixture(){
 const challenges=new Map(),sessions=new Map(),audit=[];
 const row={id:ticket,owner_email:reporter.email,kind:'bug',routing:'agent',status:'open',
  revision:0,subject:'Scan issue'};
 const db={
  prepare(sql){
   const query={params:[],
    bind(...args){this.params=args;return this;},
    async first(){
     const p=this.params;
     if(sql.startsWith('SELECT content FROM support_messages'))return {content:'Scanner error on Windows 11'};
     if(sql.startsWith('SELECT * FROM support_admin_challenges')){
      const challenge=challenges.get(p[0]);return challenge?.owner_email===p[1]&&!challenge.consumed_at&&
       challenge.expires_at>p[2]&&challenge.attempts<5?challenge:null;
     }
     if(sql.startsWith('SELECT token_hash FROM support_admin_sessions')){
      const session=sessions.get(p[0]);return session?.owner_email===p[1]&&session.expires_at>p[2]?session:null;
     }
     throw Error('unexpected first '+sql);
    },
    async run(){
     const p=this.params;
     if(sql.startsWith('INSERT INTO support_admin_challenges')){
      const [id,owner_email,verification_token,expires_at,attempts,created_at]=p;
      challenges.set(id,{id,owner_email,verification_token,expires_at,attempts,created_at});
      return {meta:{changes:1}};
     }
     if(sql.startsWith('UPDATE support_admin_challenges SET attempts')){
      const x=challenges.get(p[0]);if(x)x.attempts++;
      return {meta:{changes:x?1:0}};
     }
     if(sql.startsWith('UPDATE support_admin_challenges SET consumed_at')){
      const x=challenges.get(p[1]);if(!x||x.consumed_at)return {meta:{changes:0}};
      x.consumed_at=p[0];return {meta:{changes:1}};
     }
     if(sql.startsWith('INSERT INTO support_admin_sessions')){
      const [token_hash,owner_email,expires_at,created_at]=p;
      sessions.set(token_hash,{token_hash,owner_email,expires_at,created_at});return {meta:{changes:1}};
     }
     if(sql.startsWith('INSERT INTO support_audit_events')){audit.push(p);return {meta:{changes:1}};}
     if(sql.startsWith("UPDATE support_tickets SET routing='expert'")){
      if(row.routing!=='agent')return {meta:{changes:0}};
      row.routing='expert';row.revision++;return {meta:{changes:1}};
     }
     throw Error('unexpected run '+sql);
    }
   };
   return query;
  }
 };
 const callAuth=async(name,args)=>{
  if(name==='start')return {verificationToken:'encrypted-email-challenge-xxxxxxxxxxxxxxxxxxxxx'};
  if(name==='verify'&&args.code==='123456')return {sessionToken:'newly-verified-email-session-token-xxxxxxx'};
  if(name==='session'&&args.sessionToken==='newly-verified-email-session-token-xxxxxxx')
   return {email:owner.email,expiresAt:Date.now()+600000};
  throw Object.assign(Error('unauthorized'),{status:401});
 };
 const lookup=async(_db,id,mail)=>{
  if(id!==ticket||mail!==reporter.email)throw Object.assign(Error('not_found'),{status:404});
  return row;
 };
 const invoke=(endpoint,actor,body={},env={})=>handleAdvancedSupport({
  db,env,request,endpoint,body,actor,lookup,rate:async()=>{},callAuth
 });
 return {db,invoke,challenge:challenges,session:sessions,audit,row};
}
test('agent is unavailable without approved exact sanitized report',async()=>{
 const f=fixture(),env={SUPPORT_AI_ENABLED:'true'};
 await assert.rejects(f.invoke('agent',reporter,{ticketId:ticket,consent:false,previewSha:'0'.repeat(64)},env),{status:400});
 await assert.rejects(f.invoke('agent',reporter,{ticketId:ticket,consent:true,previewSha:'0'.repeat(64)},env),{status:409});
 assert.equal(f.audit.length,0);
 assert.equal(supportAdvancedHealth({}).aiEnabled,false);
});
test('escalation is one-way, owner-checked and queued for human without false mail claims',async()=>{
 const f=fixture();
 await assert.rejects(f.invoke('escalate',{email:'other@example.test'},{ticketId:ticket}),{status:404});
 const r=await f.invoke('escalate',reporter,{ticketId:ticket});
 assert.equal(r.routing,'expert');assert.equal(r.expertNotification,'in_app_queue');
 assert.equal(f.row.routing,'expert');
 await assert.rejects(f.invoke('escalate',reporter,{ticketId:ticket}),{status:409});
});
test('admin needs configured email plus independently verified one-time step-up',async()=>{
 const f=fixture(),env={SUPPORT_ADMIN_EMAIL:owner.email,SUPPORT_ADMIN_ENABLED:'true'};
 assert.equal(supportAdvancedHealth(env).adminEnabled,true);
 assert.equal(await checkSupportAdmin(f.db,env,'unverified-session',owner.email),false);
 await assert.rejects(f.invoke('admin-code-start',reporter,{},env),{status:403});
 const sent=await f.invoke('admin-code-start',owner,{},env);
 assert.equal(sent.delivery,'provider_accepted');
 assert.match(sent.challengeId,/^[a-f0-9-]{36}$/);
 const verified=await f.invoke('admin-code-verify',owner,{
  challengeId:sent.challengeId,code:'123456'
 },env);
 assert.equal(typeof verified.accessToken,'string');
 assert.equal(await checkSupportAdmin(f.db,env,verified.accessToken,owner.email),true);
 assert.equal(await checkSupportAdmin(f.db,env,verified.accessToken,reporter.email),false);
 await assert.rejects(f.invoke('admin-code-verify',owner,{
  challengeId:sent.challengeId,code:'123456'
 },env),{status:401});
});
