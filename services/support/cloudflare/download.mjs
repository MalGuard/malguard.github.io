// Only the verified ticket owner or OTP-stepped-up MalGuard support admin
// can download a finalized, reviewed attachment. R2 never exposes public URLs.
import {checkSupportAdmin} from './advanced.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const email=s=>typeof s==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s.toLowerCase():null;
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const json=(status,reason)=>new Response(JSON.stringify({error:reason}),{status,
 headers:{'content-type':'application/json','cache-control':'no-store'}});
async function verifiedIdentity(request){
 const auth=request.headers.get('authorization')||'';
 const token=/^Bearer ([A-Za-z0-9._-]{20,16000})$/.exec(auth)?.[1];
 if(!token)return null;
 try{
  const res=await fetch('https://game-scam-guard-connected.vercel.app/api/game-scam-guard/auth/session',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionToken:token})});
  if(!res.ok)return null;
  const body=await res.json();
  if(!Number.isFinite(body.expiresAt)||body.expiresAt<=Date.now())return null;
  const owner=email(body.email);
  return owner?{email:owner,token}:null;
 }catch{return null;}
}
export async function serveSupportAttachment({request,env}){
 if(request.method!=='POST')return json(405,'method_not_allowed');
 if(env?.SUPPORT_TICKETS_ENABLED!=='true'||env?.SUPPORT_ATTACHMENTS_ENABLED!=='true'||
   !env?.SUPPORT_DB||!env?.SUPPORT_FILES)return json(503,'not_available');
 const user=await verifiedIdentity(request);
 if(!user)return json(401,'login_required');
 let body;
 try{
  if(Number(request.headers.get('content-length'))>1500)return json(413,'request_too_large');
  const raw=await request.text();
  if(raw.length>1500)return json(413,'request_too_large');
  body=JSON.parse(raw);
 }catch{return json(400,'invalid_json');}
 if(!UUID.test(body?.ticketId||'')||!UUID.test(body?.attachmentId||''))
   return json(400,'invalid_attachment');
 const db=env.SUPPORT_DB;
 const ticket=await db.prepare('SELECT id,owner_email FROM support_tickets WHERE id=?')
   .bind(body.ticketId).first();
 if(!ticket)return json(404,'not_found');
 const privileged=await checkSupportAdmin(db,env,user.token,user.email);
 if(!privileged&&ticket.owner_email!==user.email)return json(404,'not_found');
 const file=await db.prepare("SELECT id,name,content_type,bytes,verified_sha256,state FROM support_attachments WHERE ticket_id=? AND id=?")
  .bind(ticket.id,body.attachmentId).first();
 if(!file||file.state!=='ready'||!file.verified_sha256||file.bytes<1||
    file.bytes>5242880||!['image/png','text/plain'].includes(file.content_type))
   return json(404,'not_found');
 const obj=await env.SUPPORT_FILES.get('tickets/'+ticket.id+'/ready/'+file.id);
 if(!obj)return json(503,'attachment_unavailable');
 const bytes=new Uint8Array(await obj.arrayBuffer());
 if(bytes.length!==file.bytes||await sha(bytes)!==file.verified_sha256)
   return json(503,'attachment_integrity_failed');
 const filename=String(file.name||'attachment').replace(/[\\/\r\n\x00-\x1f"<>]/g,'_').slice(0,120);
 const encoded=encodeURIComponent(filename);
 return new Response(bytes,{status:200,headers:{
  'content-type':file.content_type,
  'content-disposition':"attachment; filename=\"support-attachment\"; filename*=UTF-8''"+encoded,
  'content-length':String(bytes.length),'cache-control':'private, no-store',
  'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",
  'referrer-policy':'no-referrer'
 }});
}
