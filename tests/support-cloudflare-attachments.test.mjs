import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAttachment,attachmentHealth} from '../services/support/cloudflare/attachments.mjs';

const ticketId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor={email:'reporter@example.test'};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
 .map(x=>x.toString(16).padStart(2,'0')).join('');
function fixture(){
 const meta=new Map(),parts=[],files=new Map();
 const db={
  prepare(sql){
   let args=[];
   const obj={
    bind(...a){args=a;return obj;},
    async first(){
     if(sql.startsWith('SELECT count(*)'))return {total:[...meta.values()].filter(x=>x.ticket_id===args[0]&&x.kind===args[1]&&x.state!=='deleted').length};
     if(sql.startsWith('SELECT * FROM support_attachments'))return meta.get(args[0])?.ticket_id===args[1]?meta.get(args[0]):null;
     if(sql.startsWith('SELECT sha256 FROM support_attachment_parts')){
      return parts.find(x=>x.attachment_id===args[0]&&x.part_index===args[1])||null;
     }
     throw Error('unexpected first '+sql);
    },
    async all(){
     if(sql.startsWith('SELECT part_index,'))return {results:parts.filter(x=>x.attachment_id===args[0]).sort((a,b)=>a.part_index-b.part_index)};
     if(sql.startsWith('SELECT id,kind,name,'))return {results:[...meta.values()].filter(x=>x.ticket_id===args[0]).map(x=>({
      id:x.id,kind:x.kind,name:x.name,bytes:x.bytes,state:x.state,verified_sha256:x.verified_sha256,
      consent_sha256:x.consent_sha256,revoked_at:x.revoked_at
     }))};
     throw Error('unexpected all '+sql);
    },
    async run(){
     if(sql.startsWith('INSERT INTO support_attachments')){
      const [id,ticket_id,kind,name,content_type,bytes,part_count,expected_sha256,state,created_at]=args;
      meta.set(id,{id,ticket_id,kind,name,content_type,bytes,part_count,expected_sha256,state,created_at});return {success:true};
     }
     if(sql.startsWith('INSERT INTO support_attachment_parts')){
      const [attachment_id,part_index,bytes,sha256,object_key,created_at]=args;
      parts.push({attachment_id,part_index,bytes,sha256,object_key,created_at});return {success:true};
     }
     if(sql.includes("SET state='ready'")){
      const f=meta.get(args[1]);f.state='ready';f.verified_sha256=args[0];return {success:true};
     }
     if(sql.startsWith('DELETE FROM support_attachment_parts')){
      for(let i=parts.length-1;i>=0;i--)if(parts[i].attachment_id===args[0])parts.splice(i,1);
      return {success:true};
     }
     if(sql.includes('SET consent_sha256=?,consent_at=?')){
      const f=meta.get(args[2]);f.consent_sha256=args[0];f.consent_at=args[1];f.revoked_at=null;return {success:true};
     }
     if(sql.includes('SET consent_sha256=NULL,revoked_at=?')){
      const f=meta.get(args[1]);f.consent_sha256=null;f.revoked_at=args[0];return {success:true};
     }
     throw Error('unexpected run '+sql);
    }
   };
   return obj;
  }
 };
 const bucket={
  async put(k,v){files.set(k,new Uint8Array(v));},
  async get(k){
   const v=files.get(k);
   return v?{arrayBuffer:async()=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}:null;
  },
  async delete(k){files.delete(k);}
 };
 const env={SUPPORT_FILES:bucket,SUPPORT_ATTACHMENTS_ENABLED:'true'};
 const lookup=async(_db,id,owner)=>{
  if(id!==ticketId||owner!==actor.email)throw Object.assign(Error('not_found'),{status:404});
  return {id:ticketId,status:'open'};
 };
 const run=(endpoint,body={},request=new Request('https://support-preview.malguard.site/api/support/'+endpoint))=>
  handleAttachment({db,env,actor,endpoint,request,body:{ticketId,...body},
    lookup,rate:async()=>{}});
 return {run,meta,parts,files,env};
}

test('private redacted log is chunked, hashed, stored without public URL and consented by digest',async()=>{
 const f=fixture();
 assert.equal(attachmentHealth(f.env).attachmentsEnabled,true);
 const bytes=new TextEncoder().encode('Scanner error on Windows 11');
 const hash=await sha(bytes);
 const start=await f.run('attachment-start',{kind:'log',name:'scanner.log',
   bytes:bytes.byteLength,partCount:1,contentType:'text/plain',sha256:hash,reviewed:true});
 assert.match(start.attachmentId,/^[a-f0-9-]{36}$/);
 const chunk=await f.run('attachment-chunk',{attachmentId:start.attachmentId,index:0,
  data:Buffer.from(bytes).toString('base64')});
 assert.equal(chunk.received,true);
 const completed=await f.run('attachment-finish',{attachmentId:start.attachmentId});
 assert.deepEqual(completed,{state:'ready',sha256:hash,modelAccess:false});
 const listed=await f.run('attachment-list');
 assert.equal(listed.attachments.length,1);
 assert.equal(listed.attachments[0].aiApproved,false);
 assert.ok(!JSON.stringify(listed).includes('tickets/'+ticketId));
 await assert.rejects(f.run('attachment-approve',{attachmentId:start.attachmentId,
  sha256:'0'.repeat(64),agree:true}),{status:409});
 const yes=await f.run('attachment-approve',{attachmentId:start.attachmentId,sha256:hash,agree:true});
 assert.equal(yes.approved,true);
 assert.equal((await f.run('attachment-list')).attachments[0].aiApproved,true);
 await f.run('attachment-revoke',{attachmentId:start.attachmentId});
 assert.equal((await f.run('attachment-list')).attachments[0].aiApproved,false);
 assert.equal(f.files.size,1,'Only final reviewed private object remains in bucket');
});

test('unredacted secrets remain rejected even when user claims review',async()=>{
 const f=fixture();
 const bytes=new TextEncoder().encode('Authorization: Bearer private-placeholder-not-a-real-token');
 const hash=await sha(bytes);
 const start=await f.run('attachment-start',{kind:'log',name:'log.txt',
   bytes:bytes.byteLength,partCount:1,contentType:'text/plain',sha256:hash,reviewed:true});
 await f.run('attachment-chunk',{attachmentId:start.attachmentId,index:0,
  data:Buffer.from(bytes).toString('base64')});
 await assert.rejects(f.run('attachment-finish',{attachmentId:start.attachmentId}),{status:422});
 assert.equal(f.files.size,1,'Unverified private part never becomes finalized attachment');
});

test('external executable formats, oversized files and wrong chunk bounds are rejected',async()=>{
 const f=fixture(),h='0'.repeat(64);
 for(const spec of [
  {kind:'executable',name:'file.exe',bytes:100,partCount:1,contentType:'application/x-msdownload'},
  {kind:'image',name:'screen.png',bytes:5242881,partCount:11,contentType:'image/png'},
  {kind:'log',name:'../secrets.txt',bytes:20,partCount:1,contentType:'text/plain'}
 ])await assert.rejects(f.run('attachment-start',{...spec,sha256:h,reviewed:true}),{status:400});
 assert.equal(attachmentHealth({SUPPORT_FILES:f.env.SUPPORT_FILES}).attachmentsEnabled,false);
});
