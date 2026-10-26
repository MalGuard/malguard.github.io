import {createHash} from 'node:crypto';
import {createEmailAuth} from './email-auth.js';
const BUCKET='malguard-ai-library-v1';
const MAX=262144;
const fail=(status,stage='validation',upstreamStatus)=>Object.assign(new Error('library_unavailable'),{status,stage,upstreamStatus});
export function validateLibrary(value){
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['chats','notes'].includes(k)))throw fail(400);
 if(!Array.isArray(value.chats)||value.chats.length>30||!Array.isArray(value.notes)||value.notes.length>20)throw fail(400);
 const string=(v,max)=>typeof v==='string'&&v.length<=max;
 const chats=value.chats.map(c=>{
  if(!c||!string(c.id,40)||!/^[a-zA-Z0-9-]{1,40}$/.test(c.id)||!string(c.title,100)||!['chat','worker','build'].includes(c.mode)||!Array.isArray(c.messages)||c.messages.length>64||!Number.isSafeInteger(c.updatedAt)||typeof c.archived!=='boolean')throw fail(400);
  return {id:c.id,title:c.title,mode:c.mode,updatedAt:c.updatedAt,archived:c.archived,messages:c.messages.map(m=>{if(!m||!['user','assistant'].includes(m.role)||!string(m.text,12000))throw fail(400);return {role:m.role,text:m.text};})};
 });
 if(new Set(chats.map(c=>c.id)).size!==chats.length)throw fail(400);
 const notes=value.notes.map(n=>{if(!string(n,1000))throw fail(400);return n;});
 const clean={chats,notes};if(Buffer.byteLength(JSON.stringify(clean))>MAX)throw fail(413);return clean;
}
export function createLibrary({auth=createEmailAuth(),url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 let origin;try{const parsed=new URL(String(url||'').trim());if(parsed.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)&&!parsed.username&&!parsed.password)origin=parsed.origin;}catch{}
 async function storage(path,options={}){
  if(!origin||!key)throw fail(503,'configuration');
  const response=await fetchImpl(`${origin}/storage/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
  if(response.headers.get('content-length')>MAX)throw fail(502);const raw=await response.text();if(Buffer.byteLength(raw)>MAX)throw fail(502);
  let data;try{data=JSON.parse(raw);}catch{throw fail(502);}return {ok:response.ok,status:response.status,data};
 }
 async function privateBucket(){
  let r=await storage(`bucket/${BUCKET}`);
  if(r.status===404||String(r.data?.statusCode)==='404'||r.data?.code==='NoSuchBucket'){
   const made=await storage('bucket',{method:'POST',body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,file_size_limit:MAX,allowed_mime_types:['application/json']})});
   if(!made.ok&&made.status!==409)throw fail(503,'bucket_create',made.status);r=await storage(`bucket/${BUCKET}`);
  }
  if(!r.ok)throw fail(503,'bucket_lookup',r.status);if(r.data.public!==false)throw fail(503,'private_bucket_required');
 }
 return async function run(token,value){
  if(typeof token!=='string'||token.length>16000)throw fail(401);
  const p=auth.session({sessionToken:token});if(!p||typeof p.email!=='string'||!Number.isFinite(p.expiresAt)||p.expiresAt<=Date.now())throw fail(401);
  const clean=value===undefined?undefined:validateLibrary(value);
  await privateBucket();
  // Ownership comes exclusively from the authenticated session, never a caller path.
  const owner=createHash('sha256').update(`malguard-ai-account-v1\0${p.email.trim().toLowerCase()}`).digest('hex');
  const path=`object/${BUCKET}/${owner}/library.json`;
  if(clean){const r=await storage(path,{method:'POST',headers:{'x-upsert':'true'},body:JSON.stringify(clean)});if(!r.ok)throw fail(503,'object_write',r.status);return {saved:true};}
  const r=await storage(path);if(r.status===404||String(r.data?.statusCode)==='404'||r.data?.code==='NoSuchKey')return {chats:[],notes:[]};if(!r.ok)throw fail(503,'object_read',r.status);return validateLibrary(r.data);
 };
}
