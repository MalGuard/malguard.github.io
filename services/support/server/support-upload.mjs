import {createHash} from 'node:crypto';
import {validateAttachmentSpec,validateCompletedFile,CHUNK_BYTES} from './support-attachments.mjs';
import {createAttachmentStorage} from './support-attachments.mjs';
import {createAttachmentStore} from './support-attachment-store.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const digest=buf=>createHash('sha256').update(buf).digest('hex');
function decodeChunk(raw){
 if(typeof raw!=='string'||raw.length>699056||raw.length<4||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw fail(400,'invalid_chunk');
 const bytes=Buffer.from(raw,'base64');
 if(bytes.length<1||bytes.length>CHUNK_BYTES||
   bytes.toString('base64')!==raw)throw fail(400,'invalid_chunk');
 return bytes;
}
const view=row=>({id:row.id,name:row.original_name,kind:row.kind,bytes:row.file_bytes,
 state:row.state,redactedSha256:row.sanitized_sha256,
 createdAt:row.created_at,deletedAt:row.deleted_at});
export function createUploadService({
 meta=createAttachmentStore(),storage=createAttachmentStorage(),
 enabled=process.env.SUPPORT_ATTACHMENTS_ENABLED==='true'
}={}){
 const available=enabled&&meta.enabled&&storage.enabled;
 const check=()=>{if(!available)throw fail(503,'attachments_unavailable');};
 const valid=(v)=>{if(!UUID.test(v||''))throw fail(400,'invalid_attachment');return v;};
 async function belong(ticketId,id){
  const row=await meta.get(ticketId,valid(id));
  if(!row)throw fail(404,'attachment_not_found');
  return row;
 }
 return {
  available,
  async list(ticketId){
   check();return {attachments:(await meta.list(ticketId)).map(view)};
  },
  async begin(ticketId,input){
   check();
   const spec=validateAttachmentSpec(input);
   // An opt-in privacy review happened in the client; no original is uploaded to AI.
   if(input.reviewed!==true)throw fail(403,'preview_confirmation_required');
   await storage.privateBucket();
   const row=await meta.begin(ticketId,spec);
   return {attachmentId:row.id,chunkBytes:CHUNK_BYTES};
  },
  async chunk(ticketId,input){
   check();
   const row=await belong(ticketId,input.attachmentId);
   if(row.state!=='pending')throw fail(409,'invalid_attachment_state');
   if(!Number.isSafeInteger(input.index)||input.index<0||input.index>=row.part_count)
      throw fail(400,'invalid_part_index');
   const bytes=decodeChunk(input.data);
   const path=row.original_object_key+'/parts/'+input.index;
   await storage.put(path,bytes);
   const ok=await meta.part(ticketId,row.id,input.index,bytes.length,digest(bytes),path);
   if(ok!==true)throw fail(503,'attachment_metadata_unavailable');
   return {saved:true,index:input.index};
  },
  async finish(ticketId,input){
   check();
   const row=await belong(ticketId,input.attachmentId);
   if(row.state!=='pending')throw fail(409,'invalid_attachment_state');
   const parts=await meta.parts(row.id);
   if(parts.length!==row.part_count)throw fail(409,'attachment_incomplete');
   const chunks=[],total=parts.reduce((n,p)=>n+p.byte_size,0);
   if(total!==row.file_bytes)throw fail(422,'attachment_size_mismatch');
   for(let index=0;index<parts.length;index++){
    const p=parts[index];
    if(p.part_index!==index||p.object_key!==row.original_object_key+'/parts/'+index)
      throw fail(422,'attachment_parts_corrupted');
    const blob=await storage.read(p.object_key,CHUNK_BYTES);
    if(blob.length!==p.byte_size||digest(blob)!==p.part_sha256)
      throw fail(422,'attachment_chunk_hash_mismatch');
    chunks.push(blob);
   }
   const merged=Buffer.concat(chunks,total);
   const sha=validateCompletedFile(merged,{kind:row.kind,bytes:row.file_bytes,sha256:row.original_sha256});
   // No EXIF/metadata is sent by us: images must be browser canvas-exported PNG.
   // Log text requires a separately reviewed local privacy preview.
   await storage.put(row.original_object_key,merged,row.content_type);
   const ready=await meta.ready(ticketId,row.id,sha);
   if(ready?.state!=='ready')throw fail(503,'attachment_metadata_unavailable');
   // Optional orphan cleanup failures must not mark a ready upload as unsaved.
   for(const p of parts){try{await storage.remove(p.object_key);}catch{}}
   return {attachmentId:row.id,state:'ready',sha256:sha,modelAccess:false};
  },
  async approve(ticketId,input){
   check();
   const row=await belong(ticketId,input.attachmentId);
   if(row.state!=='ready'||input.sha256!==row.sanitized_sha256)
     throw fail(409,'attachment_version_changed');
   if(input.agree!==true)throw fail(403,'explicit_consent_required');
   if(await meta.approve(ticketId,row.id,row.sanitized_sha256)!==true)
     throw fail(503,'attachment_consent_unconfirmed');
   return {approved:true,attachmentId:row.id};
  },
  async revoke(ticketId,input){
   check();
   const row=await belong(ticketId,input.attachmentId);
   if(await meta.revoke(ticketId,row.id)!==true)throw fail(503,'attachment_consent_unconfirmed');
   return {revoked:true,attachmentId:row.id};
  },
  async cleanup(nowIso=new Date().toISOString()){
   check();const eligible=await meta.eligibleForCleanup(nowIso);let deleted=0,failed=0;
   for(const ticket of eligible){
    const rows=await meta.list(ticket.id);
    for(const a of rows){
     if(a.state==='deleted')continue;
     try{
      const full=await meta.get(ticket.id,a.id);
      if(!full)throw Error('metadata_missing');
      // Delete both completed candidate and residual chunk objects.
      const parts=await meta.parts(a.id);
      for(const part of parts)await storage.remove(part.object_key);
      await storage.remove(full.original_object_key);
      if(full.sanitized_object_key&&full.sanitized_object_key!==full.original_object_key)
       await storage.remove(full.sanitized_object_key);
      if(await meta.markDeleted(ticket.id,a.id)!==true)throw Error('db_deletion_not_confirmed');
      deleted++;
     }catch{failed++;}
    }
   }
   return {deleted,failed,checkedTickets:eligible.length};
  }
 };
}
