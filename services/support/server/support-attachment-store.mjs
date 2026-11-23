// Server-only metadata adapter for private support attachments.
import {randomUUID} from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const validId=value=>UUID.test(value||'');
export function createAttachmentStore({url=process.env.SUPABASE_URL,
 key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 let origin;
 try{const u=new URL(String(url||''));if(u.protocol==='https:'&&
   /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&u.pathname==='/'&&!u.username&&!u.password)origin=u.origin;}catch{}
 const enabled=!!origin&&typeof key==='string'&&key.length>20;
 async function query(path,{method='GET',body}={}){
  if(!enabled)throw fail(503,'attachment_metadata_unavailable');
  let resp;
  try{resp=await fetchImpl(origin+'/rest/v1/'+path,{
    method,redirect:'error',cache:'no-store',
    headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',
     accept:'application/json',...(method==='POST'||method==='PATCH'?{prefer:'return=representation'}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000)
  });}catch{throw fail(503,'attachment_metadata_unavailable');}
  const raw=await resp.text().catch(()=>'');
  if(Buffer.byteLength(raw)>262144)throw fail(502,'attachment_metadata_unavailable');
  let data=null;try{data=raw?JSON.parse(raw):null;}catch{throw fail(502,'attachment_metadata_unavailable');}
  if(!resp.ok)throw fail(resp.status===409?409:503,'attachment_metadata_unavailable');
  return data;
 }
 const rpc=(name,params)=>query('rpc/'+name,{method:'POST',body:params});
 async function get(ticketId,id){
  if(!validId(id)||!validId(ticketId))throw fail(400,'invalid_attachment');
  const rows=await query('support_attachments?ticket_id=eq.'+ticketId+'&id=eq.'+id+
   '&select=id,ticket_id,kind,content_type,original_name,file_bytes,part_count,original_object_key,original_sha256,sanitized_object_key,sanitized_sha256,state,created_at,reviewed_at,deleted_at&limit=1');
  if(!Array.isArray(rows))throw fail(502,'attachment_metadata_unavailable');
  return rows[0]||null;
 }
 async function list(ticketId){
  if(!validId(ticketId))throw fail(400,'invalid_ticket');
  const rows=await query('support_attachments?ticket_id=eq.'+ticketId+
   '&select=id,kind,original_name,file_bytes,state,created_at,sanitized_sha256,deleted_at&order=created_at.asc&limit=12');
  if(!Array.isArray(rows))throw fail(502,'attachment_metadata_unavailable');
  return rows;
 }
 async function consents(ticketId){
   if(!validId(ticketId))throw fail(400,'invalid_ticket');
   const rows=await query('support_permissions?ticket_id=eq.'+ticketId+
     '&kind=eq.attachment_analysis&approved=eq.true&revoked_at=is.null'+
     '&select=resource_id,approved_redacted_sha256&limit=20');
   if(!Array.isArray(rows))throw fail(502,'attachment_metadata_unavailable');
   return rows;
 }
 return {enabled,get,list,consents,
  async begin(ticketId,spec){
   if(!validId(ticketId))throw fail(400,'invalid_ticket');
   const id=randomUUID();
   const objectKey='tickets/'+ticketId+'/'+id+'/safe';
   const row=await rpc('support_begin_attachment',{
    p_id:id,p_ticket_id:ticketId,p_kind:spec.kind,p_name:spec.name,
    p_content_type:spec.contentType,p_bytes:spec.bytes,
    p_part_count:spec.partCount,p_sha256:spec.sha256,p_object_key:objectKey
   });
   if(!row||row.id!==id)throw fail(502,'attachment_metadata_unavailable');
   return row;
  },
  async part(ticketId,id,index,byteSize,sha256,objectKey){
   return rpc('support_record_attachment_part',{p_ticket_id:ticketId,p_id:id,
     p_index:index,p_bytes:byteSize,p_sha256:sha256,p_object_key:objectKey});
  },
  async parts(id){
   if(!validId(id))throw fail(400,'invalid_attachment');
   const rows=await query('support_attachment_parts?attachment_id=eq.'+id+
    '&select=part_index,byte_size,part_sha256,object_key&order=part_index.asc&limit=16');
   if(!Array.isArray(rows))throw fail(502,'attachment_metadata_unavailable');
   return rows;
  },
  ready:(ticketId,id,sha256)=>rpc('support_finish_attachment',{
   p_ticket_id:ticketId,p_id:id,p_sha256:sha256
  }),
  approve:(ticketId,id,sha256)=>rpc('support_approve_attachment',{
   p_ticket_id:ticketId,p_id:id,p_sha256:sha256
  }),
  revoke:(ticketId,id)=>rpc('support_revoke_attachment',{
   p_ticket_id:ticketId,p_id:id
  }),
  async eligibleForCleanup(nowIso){
   const rows=await query('support_tickets?status=eq.closed&attachments_delete_at=lte.'+
    encodeURIComponent(nowIso)+'&select=id&order=attachments_delete_at.asc&limit=20');
   if(!Array.isArray(rows))throw fail(502,'attachment_metadata_unavailable');
   return rows;
  },
  async markDeleted(ticketId,id){
   return rpc('support_mark_attachment_deleted',{p_ticket_id:ticketId,p_id:id});
  }
 };
}
