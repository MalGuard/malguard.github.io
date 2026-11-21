// Cloudflare R2 private, reviewed-only attachment service for MalGuard Support.
// No public R2 URLs, no executable uploads, no AI access without exact-hash consent.
import {redactLog,validateLogText} from '../../../assets/support-privacy.mjs';
import {checkSupportAdmin} from './advanced.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const MAX_PART=512*1024,MAX_IMAGE=5*1024*1024,MAX_LOG=2*1024*1024;
const TYPES={image:'image/png',log:'text/plain'};
const error=(status,code)=>Object.assign(new Error(code),{status,code});
const time=()=>new Date().toISOString();
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
  .map(x=>x.toString(16).padStart(2,'0')).join('');
const objKey=(ticket,id,part)=>'tickets/'+ticket+'/attachments/'+id+'/'+part;
const readyKey=(ticket,id)=>'tickets/'+ticket+'/ready/'+id;
function enabled(env){
 return env?.SUPPORT_ATTACHMENTS_ENABLED==='true'&&
   typeof env?.SUPPORT_FILES?.put==='function'&&typeof env?.SUPPORT_FILES?.get==='function'&&
   typeof env?.SUPPORT_FILES?.delete==='function';
}
function checkSpec(b){
 const limit=b.kind==='image'?MAX_IMAGE:MAX_LOG;
 if(!TYPES[b.kind]||b.contentType!==TYPES[b.kind]||
   typeof b.name!=='string'||!b.name.trim()||b.name.length>120||
   /[\/\\\x00-\x1f]/.test(b.name)||!Number.isSafeInteger(b.bytes)||b.bytes<1||
   b.bytes>limit||!Number.isSafeInteger(b.partCount)||b.partCount!==Math.ceil(b.bytes/MAX_PART)||
   !SHA.test(b.sha256||'')||b.reviewed!==true)throw error(400,'invalid_attachment_spec');
 return b;
}
function crc(bytes,start,end){
 let state=0xffffffff;
 for(let i=start;i<end;i++){
   state^=bytes[i];
   for(let j=0;j<8;j++)state=(state>>>1)^((state&1)?0xedb88320:0);
 }
 return (state^0xffffffff)>>>0;
}
function checkPng(bytes){
 const sig=[137,80,78,71,13,10,26,10];
 if(bytes.length<45||!sig.every((x,i)=>bytes[i]===x))throw error(415,'invalid_png');
 const allowed=new Set(['IHDR','IDAT','IEND','sRGB','gAMA','cHRM','pHYs']);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let pos=8,header=false,idat=false,ended=false;
 while(pos+12<=bytes.length){
   const size=view.getUint32(pos),typ=String.fromCharCode(...bytes.slice(pos+4,pos+8));
   if(size>bytes.length-pos-12||!allowed.has(typ)||!header&&typ!=='IHDR')
     throw error(415,'invalid_png');
   if(view.getUint32(pos+8+size)!==crc(bytes,pos+4,pos+8+size))
     throw error(415,'invalid_png_crc');
   if(typ==='IHDR'){
     if(header||size!==13)throw error(415,'invalid_png');
     const width=view.getUint32(pos+8),height=view.getUint32(pos+12);
     if(!width||!height||width*height>16000000||![8,16].includes(bytes[pos+16])||
       ![0,2,4,6].includes(bytes[pos+17]))throw error(415,'invalid_png');
     header=true;
   }
   if(typ==='IDAT')idat=true;
   pos+=size+12;
   if(typ==='IEND'){
     if(!idat||size!==0||pos!==bytes.length)throw error(415,'invalid_png');
     ended=true;break;
   }
 }
 if(!header||!idat||!ended)throw error(415,'invalid_png');
}
function validateFile(bytes,meta){
 if(meta.kind==='image'){checkPng(bytes);return;}
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{
   throw error(415,'invalid_log_encoding');
 }
 if(!validateLogText(text)||redactLog(text).redacted!==text)
   throw error(422,'privacy_redaction_required');
}
async function findFile(db,ticket,id){
 if(!UUID.test(id||''))throw error(400,'invalid_attachment');
 const meta=await db.prepare('SELECT * FROM support_attachments WHERE id=? AND ticket_id=?')
   .bind(id,ticket).first();
 if(!meta)throw error(404,'attachment_not_found');
 return meta;
}
export function attachmentHealth(env){
 return {attachmentsEnabled:enabled(env)};
}
export async function handleAttachment({db,env,body,endpoint,actor,lookup,rate,request}){
 if(!enabled(env))throw error(503,'private_uploads_not_enabled');
 const allowed=new Set(['attachment-start','attachment-chunk','attachment-finish',
  'attachment-list','attachment-approve','attachment-revoke']);
 if(!allowed.has(endpoint))throw error(404,'unsupported_attachment_operation');
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
 const isAdmin=await checkSupportAdmin(db,env,bearer,actor.email);
 if(isAdmin&&endpoint!=='attachment-list')throw error(403,'admin_cannot_grant_reporter_consent');
 let row;
 if(isAdmin){
   if(!UUID.test(body.ticketId||''))throw error(400,'invalid_ticket');
   row=await db.prepare('SELECT id,status FROM support_tickets WHERE id=?').bind(body.ticketId).first();
   if(!row)throw error(404,'ticket_not_found');
 }else row=await lookup(db,body.ticketId,actor.email);
 await rate(env,request,'attachment-ops',120,3600000);
 if(endpoint==='attachment-list'){
   const items=await db.prepare('SELECT id,kind,name,bytes,state,verified_sha256,consent_sha256,revoked_at FROM support_attachments WHERE ticket_id=? ORDER BY created_at DESC LIMIT 20')
     .bind(row.id).all();
   return {attachments:(items.results||[]).map(x=>({id:x.id,kind:x.kind,name:x.name,
     bytes:x.bytes,state:x.state,redactedSha256:x.verified_sha256,
     aiApproved:x.state==='ready'&&!!x.verified_sha256&&
       x.verified_sha256===x.consent_sha256&&!x.revoked_at}))};
 }
 if(endpoint==='attachment-revoke'){
   const file=await findFile(db,row.id,body.attachmentId);
   await db.prepare('UPDATE support_attachments SET consent_sha256=NULL,revoked_at=? WHERE id=? AND ticket_id=?')
     .bind(time(),file.id,row.id).run();
   return {revoked:true};
 }
 if(row.status!=='open')throw error(409,'ticket_closed');
 if(endpoint==='attachment-start'){
   const spec=checkSpec(body),max=spec.kind==='image'?3:1;
   const count=await db.prepare("SELECT count(*) AS total FROM support_attachments WHERE ticket_id=? AND kind=? AND state!='deleted'")
     .bind(row.id,spec.kind).first();
   if((count?.total||0)>=max)throw error(409,'attachment_quota_reached');
   const id=crypto.randomUUID();
   await db.prepare('INSERT INTO support_attachments(id,ticket_id,kind,name,content_type,bytes,part_count,expected_sha256,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
     .bind(id,row.id,spec.kind,spec.name,spec.contentType,spec.bytes,spec.partCount,
       spec.sha256,'pending',time()).run();
   return {attachmentId:id,modelAccess:false};
 }
 const file=await findFile(db,row.id,body.attachmentId);
 if(endpoint==='attachment-approve'){
   if(file.state!=='ready'||body.agree!==true||body.sha256!==file.verified_sha256||
     !SHA.test(body.sha256||''))throw error(409,'exact_file_consent_required');
   await db.prepare('UPDATE support_attachments SET consent_sha256=?,consent_at=?,revoked_at=NULL WHERE id=? AND ticket_id=?')
     .bind(body.sha256,time(),file.id,row.id).run();
   return {approved:true,sha256:file.verified_sha256};
 }
 if(file.state!=='pending')throw error(409,'attachment_not_pending');
 if(endpoint==='attachment-chunk'){
   const i=body.index;
   if(!Number.isSafeInteger(i)||i<0||i>=file.part_count||
     typeof body.data!=='string'||body.data.length<4||body.data.length>699100||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data))throw error(400,'invalid_chunk');
   let data;try{
     const decoded=atob(body.data);
     data=Uint8Array.from(decoded,c=>c.charCodeAt(0));
   }catch{throw error(400,'invalid_chunk');}
   const expected=i===file.part_count-1?file.bytes-i*MAX_PART:MAX_PART;
   if(data.length!==expected||data.length>MAX_PART)throw error(400,'invalid_chunk_size');
   const hash=await digest(data);
   const existing=await db.prepare('SELECT sha256 FROM support_attachment_parts WHERE attachment_id=? AND part_index=?')
     .bind(file.id,i).first();
   if(existing){
     if(existing.sha256!==hash)throw error(409,'chunk_conflict');
     return {received:true,index:i};
   }
   const key=objKey(row.id,file.id,i);
   await env.SUPPORT_FILES.put(key,data,{httpMetadata:{contentType:'application/octet-stream'}});
   await db.prepare('INSERT INTO support_attachment_parts(attachment_id,part_index,bytes,sha256,object_key,created_at) VALUES(?,?,?,?,?,?)')
     .bind(file.id,i,data.length,hash,key,time()).run();
   return {received:true,index:i};
 }
 if(endpoint==='attachment-finish'){
   const parts=await db.prepare('SELECT part_index,bytes,sha256,object_key FROM support_attachment_parts WHERE attachment_id=? ORDER BY part_index')
     .bind(file.id).all();
   if(parts.results?.length!==file.part_count)throw error(409,'missing_attachment_chunks');
   const bytes=new Uint8Array(file.bytes);let offset=0;
   for(let i=0;i<file.part_count;i++){
     const part=parts.results[i];
     if(part.part_index!==i)throw error(409,'missing_attachment_chunks');
     const stored=await env.SUPPORT_FILES.get(part.object_key);
     if(!stored)throw error(503,'missing_private_part');
     const block=new Uint8Array(await stored.arrayBuffer());
     if(block.length!==part.bytes||await digest(block)!==part.sha256||
       offset+block.length>bytes.length)throw error(422,'chunk_checksum_failed');
     bytes.set(block,offset);offset+=block.length;
   }
   if(offset!==file.bytes||await digest(bytes)!==file.expected_sha256)
     throw error(422,'attachment_checksum_failed');
   validateFile(bytes,file);
   const key=readyKey(row.id,file.id);
   await env.SUPPORT_FILES.put(key,bytes,{httpMetadata:{contentType:file.content_type}});
   await db.prepare("UPDATE support_attachments SET state='ready',verified_sha256=? WHERE id=? AND ticket_id=? AND state='pending'")
     .bind(file.expected_sha256,file.id,row.id).run();
   for(const part of parts.results)await env.SUPPORT_FILES.delete(part.object_key);
   await db.prepare('DELETE FROM support_attachment_parts WHERE attachment_id=?').bind(file.id).run();
   return {state:'ready',sha256:file.expected_sha256,modelAccess:false};
 }
 throw error(404,'unsupported_attachment_operation');
}
