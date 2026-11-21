import test from 'node:test';
import assert from 'node:assert/strict';
import {serveSupportAttachment} from '../services/support/cloudflare/download.mjs';
const tid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownerToken='a'.repeat(44),otherToken='b'.repeat(44),adminToken='c'.repeat(44);
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))))
 .map(x=>x.toString(16).padStart(2,'0')).join('');
test('download requires owner or second-factor admin, rejects outsiders and altered bytes',async()=>{
 const text='sanitized diagnostic text',data=new TextEncoder().encode(text),sha=await hash(text),adminHash=await hash(adminToken);
 let tampered=false;
 const store={
  prepare(sql){
   const q={args:[],bind(...x){this.args=x;return this;},
    async first(){
     if(sql.startsWith('SELECT id,owner_email FROM support_tickets'))return {id:tid,owner_email:'owner@example.test'};
     if(sql.startsWith('SELECT id,name,content_type,bytes'))return {
       id:aid,name:'clean.log',content_type:'text/plain',bytes:data.length,verified_sha256:sha,state:'ready'};
     if(sql.startsWith('SELECT token_hash FROM support_admin_sessions'))
       return this.args[0]===adminHash&&this.args[1]==='contact@malguard.site'?{token_hash:adminHash}:null;
     throw Error('unexpected query '+sql);
    }
   };return q;
  }
 };
 const env={SUPPORT_TICKETS_ENABLED:'true',SUPPORT_ATTACHMENTS_ENABLED:'true',
  SUPPORT_ADMIN_ENABLED:'true',SUPPORT_ADMIN_EMAIL:'contact@malguard.site',
  SUPPORT_DB:store,SUPPORT_FILES:{get:async()=>({arrayBuffer:async()=>{
   return tampered?new TextEncoder().encode('tampered').buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  }})}};
 const previousFetch=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{
  const token=JSON.parse(options.body).sessionToken;
  const mail=token===ownerToken?'owner@example.test':
    token===adminToken?'contact@malguard.site':'outsider@example.test';
  return {ok:true,json:async()=>({email:mail,expiresAt:Date.now()+180000})};
 };
 const run=token=>serveSupportAttachment({env,request:new Request(
   'https://support-preview.malguard.site/api/support/download',{
    method:'POST',headers:{'content-type':'application/json',
     ...(token?{authorization:'Bearer '+token}:{})},
    body:JSON.stringify({ticketId:tid,attachmentId:aid})
   })});
 try{
  assert.equal((await run(null)).status,401);
  assert.equal((await run(otherToken)).status,404);
  const own=await run(ownerToken);
  assert.equal(own.status,200);
  assert.equal(own.headers.get('cache-control'),'private, no-store');
  assert.equal(own.headers.get('x-content-type-options'),'nosniff');
  assert.match(own.headers.get('content-disposition'),/^attachment;/);
  assert.equal(await own.text(),text);
  const expert=await run(adminToken);
  assert.equal(expert.status,200);
  tampered=true;
  assert.equal((await run(ownerToken)).status,503);
 }finally{globalThis.fetch=previousFetch;}
});
