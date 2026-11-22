// MalGuard Support tickets on Cloudflare Pages + D1.
// Uses the existing MalGuard email-account API to verify a signed account session.
// No duplicate account records, no secret API keys in the browser, fail closed on missing DB.
import {triageSupportCase} from '../server/support-triage.mjs';
import {handleAdvancedSupport,checkSupportAdmin,supportAdvancedHealth} from './advanced.mjs';
import {handleAttachment,attachmentHealth} from './attachments.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED=new Set(['bug','false-positive','feedback']);
const ROUTES=new Set(['agent','expert']);
const now=()=>new Date().toISOString();
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?
  value.toLowerCase():null;
const err=(status,code)=>Object.assign(new Error(code),{status,code});
const normalizeCode=value=>typeof value==='string'?
  Array.from(value.trim(),char=>char>='۰'&&char<='۹'?String(char.charCodeAt(0)-1776):
    char>='٠'&&char<='٩'?String(char.charCodeAt(0)-1632):char).join(''):null;
const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(data)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
async function limitEmailChallenge(db,address) {
 const key=await digest('support-otp-v1:'+address),future=Date.now()+15*60*1000;
 await db.prepare('INSERT INTO support_rate_limits(rate_key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN expires_at<? THEN 1 ELSE hits+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END')
  .bind(key,future,Date.now(),Date.now()).run();
 const item=await db.prepare('SELECT hits FROM support_rate_limits WHERE rate_key=?').bind(key).first();
 if((item?.hits||0)>3)throw err(429,'email_code_rate_limited');
}

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const respond=(status,obj)=>new Response(JSON.stringify(obj),{status,headers});
const getDb=env=>{
 if(env?.SUPPORT_TICKETS_ENABLED!=='true')throw err(503,'support_not_activated');
 if(!env?.SUPPORT_DB||typeof env.SUPPORT_DB.prepare!=='function')throw err(503,'support_database_unavailable');
 return env.SUPPORT_DB;
};
async function decodeRequest(request,max=8500){
 if(request.method!=='POST')throw err(405,'method_not_allowed');
 const type=request.headers.get('content-type')||'';
 if(!type.toLowerCase().startsWith('application/json'))throw err(415,'json_required');
 const len=Number(request.headers.get('content-length'));
 if(Number.isFinite(len)&&len>max)throw err(413,'request_too_large');
 let raw;
 try{raw=await request.text();}catch{throw err(400,'invalid_body');}
 if(raw.length>max)throw err(413,'request_too_large');
 let body;try{body=JSON.parse(raw);}catch{throw err(400,'invalid_json');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw err(400,'invalid_body');
 return body;
}
async function rate(env,request,action,limit=20,windowMs=60000){
 const db=getDb(env),source=request.headers.get('cf-connecting-ip')||'unspecified';
 const bytes=new TextEncoder().encode('mg-support-v1:'+action+':'+source);
 const sum=await crypto.subtle.digest('SHA-256',bytes);
 const key=Array.from(new Uint8Array(sum)).map(b=>b.toString(16).padStart(2,'0')).join('');
 const next=Date.now()+windowMs;
 await db.prepare('INSERT INTO support_rate_limits(rate_key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(rate_key) DO UPDATE SET hits=CASE WHEN expires_at<? THEN 1 ELSE hits+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END')
   .bind(key,next,Date.now(),Date.now()).run();
 const count=await db.prepare('SELECT hits FROM support_rate_limits WHERE rate_key=?').bind(key).first();
 if((count?.hits||0)>limit)throw err(429,'rate_limited');
}
async function callAuth(path,body){
 const url='https://game-scam-guard-connected.vercel.app/api/game-scam-guard/auth/'+path;
 let res;
 try{res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','cache-control':'no-store'},
    body:JSON.stringify(body)});}
 catch{throw err(503,'account_provider_unavailable');}
 const raw=await res.text().catch(()=>'');
 if(raw.length>24000)throw err(502,'account_provider_unavailable');
 if(!res.ok){
   const status=res.status===400||res.status===401?401:res.status===429?429:503;
   throw err(status,status===401?'invalid_login_or_code':status===429?'rate_limited':'account_provider_unavailable');
 }
 let data;try{data=JSON.parse(raw);}catch{throw err(502,'account_provider_unavailable');}
 return data;
}
async function actor(request){
 const header=request.headers.get('authorization')||'';
 const match=/^Bearer ([A-Za-z0-9._-]{20,16000})$/.exec(header);
 if(!match)throw err(401,'login_required');
 const session=await callAuth('session',{sessionToken:match[1]});
 const mail=email(session?.email);
 if(!mail||!Number.isFinite(session?.expiresAt)||
    session.expiresAt<=Date.now())throw err(401,'invalid_account_session');
 return {email:mail};
}
const safeText=(value,max,min=1)=>typeof value==='string'&&value.trim().length>=min&&
  value.trim().length<=max?value.trim():null;
const projection=row=>({id:row.id,kind:row.kind,routing:row.routing,subject:row.subject,
 status:row.status,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,
 closedAt:row.closed_at,attachmentsDeleteAt:row.attachments_delete_at});
async function lookup(db,id,owner){
 if(!UUID.test(id||''))throw err(400,'invalid_ticket');
 const row=await db.prepare('SELECT * FROM support_tickets WHERE id=? AND owner_email=?')
   .bind(id,owner).first();
 if(!row)throw err(404,'ticket_not_found');
 return row;
}
function responseError(error){
 const status=[400,401,403,404,405,409,413,415,429,503].includes(error?.status)?
   error.status:503;
 return respond(status,{error:status===503?'support_temporarily_unavailable':
   String(error.code||'request_invalid')});
}
export async function handleSupport(context,endpoint){
 const {request,env}=context;
 try{
  const db=getDb(env);
  if(endpoint==='auth/password'){
    const body=await decodeRequest(request,1400);
    const address=email(body.email),password=body.password;
    if(!address||typeof password!=='string'||password.length<10||password.length>128)
      throw err(400,'invalid_login');
    await rate(env,request,'account-password',6,900000);
    const result=await callAuth('password',{email:address,password});
    if(typeof result.sessionToken!=='string'||result.sessionToken.length<20)
      throw err(503,'account_provider_unavailable');
    return respond(200,{sessionToken:result.sessionToken});
  }
  if(endpoint==='auth/start'){
    const body=await decodeRequest(request,900),address=email(body.email);
    if(!address)throw err(400,'invalid_email');
    await rate(env,request,'email-login-start',4,900000);
    await limitEmailChallenge(db,address);
    const result=await callAuth('start',{email:address});
    if(typeof result?.verificationToken!=='string'||result.verificationToken.length<32||
      result.verificationToken.length>12000)throw err(503,'account_provider_unavailable');
    const challengeId=crypto.randomUUID(),time=Date.now();
    await db.prepare('INSERT INTO support_email_challenges(id,email,provider_token,expires_at,attempts,created_at) VALUES(?,?,?,?,0,?)')
      .bind(challengeId,address,result.verificationToken,time+600000,new Date(time).toISOString()).run();
    return respond(200,{challengeId,expiresInSeconds:600,delivery:'provider_accepted'});
  }
  if(endpoint==='auth/verify'){
    const body=await decodeRequest(request,1400),code=normalizeCode(body.code);
    if(!UUID.test(body.challengeId||'')||!/^[0-9]{6}$/.test(code||''))
      throw err(400,'invalid_verification');
    await rate(env,request,'email-login-verify',12,900000);
    const timestamp=Date.now(),leaseUntil=timestamp+30000;
    const challenge=await db.prepare(
      'UPDATE support_email_challenges SET attempts=attempts+1,verifying_until=? '+
      'WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempts<5 '+
      'AND (verifying_until IS NULL OR verifying_until<?) RETURNING provider_token,email')
      .bind(leaseUntil,body.challengeId,timestamp,timestamp).first();
    if(!challenge)throw err(401,'code_expired_or_too_many_attempts');
    let session;
    try{
      session=await callAuth('verify',{verificationToken:challenge.provider_token,code});
      if(typeof session?.sessionToken!=='string'||session.sessionToken.length<20)
        throw err(503,'account_provider_unavailable');
      const verified=await callAuth('session',{sessionToken:session.sessionToken});
      if(email(verified?.email)!==challenge.email)throw err(401,'email_identity_mismatch');
    }catch(cause){
      await db.prepare('UPDATE support_email_challenges SET verifying_until=NULL WHERE id=? AND verifying_until=? AND consumed_at IS NULL')
        .bind(body.challengeId,leaseUntil).run().catch(()=>{});
      throw cause;
    }
    const used=await db.prepare(
      "UPDATE support_email_challenges SET consumed_at=?,provider_token='',verifying_until=NULL "+
      'WHERE id=? AND verifying_until=? AND consumed_at IS NULL RETURNING id')
      .bind(Date.now(),body.challengeId,leaseUntil).first();
    if(!used)throw err(409,'challenge_already_used');
    return respond(200,{sessionToken:session.sessionToken});
  }
  if(!['create','list','ticket','message','close','reopen','triage','agent','escalate','admin-code-start','admin-code-verify',
     'attachment-start','attachment-chunk','attachment-finish','attachment-list','attachment-approve','attachment-revoke'].includes(endpoint))
    return respond(503,{error:'feature_not_configured'});
  const body=await decodeRequest(request,endpoint==='attachment-chunk'?730000:8500);
  const user=await actor(request);
  await rate(env,request,'tickets',100,3600000);
  if(endpoint.startsWith('attachment-')){
    const result=await handleAttachment({db,env,request,endpoint,body,actor:user,lookup,rate});
    return respond(200,result);
  }
  if(['agent','escalate','admin-code-start','admin-code-verify'].includes(endpoint)){
    const result=await handleAdvancedSupport({db,env,request,endpoint,body,actor:user,
      lookup,rate,callAuth});
    return respond(200,result);
  }
  const authorization=request.headers.get('authorization')||'';
  const accountToken=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  const isAdmin=await checkSupportAdmin(db,env,accountToken,user.email);
  if(endpoint==='create'){
    const kind=body.kind,route=body.route,subject=safeText(body.subject,160),
      message=safeText(body.message,6000,6);
    if(!ALLOWED.has(kind)||!ROUTES.has(route)||!subject||!message)
      throw err(400,'invalid_ticket');
    const id=crypto.randomUUID(),messageId=crypto.randomUUID(),time=now();
    await db.batch([
      db.prepare('INSERT INTO support_tickets(id,owner_email,kind,routing,subject,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
       .bind(id,user.email,kind,route,subject,time,time),
      db.prepare('INSERT INTO support_messages(id,ticket_id,author_kind,content,created_at) VALUES (?,?,?,?,?)')
       .bind(messageId,id,'reporter',message,time)
    ]);
    return respond(200,{accepted:true,ticketId:id,delivery:'account_ticket',email:user.email});
  }
  if(endpoint==='list'){
    const data=isAdmin?await db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50').all():
      await db.prepare('SELECT * FROM support_tickets WHERE owner_email=? ORDER BY created_at DESC LIMIT 50')
        .bind(user.email).all();
    return respond(200,{tickets:(data.results||[]).map(projection)});
  }
  let row;
  if(isAdmin){
    if(!UUID.test(body.ticketId||''))throw err(400,'invalid_ticket');
    row=await db.prepare('SELECT * FROM support_tickets WHERE id=?').bind(body.ticketId).first();
    if(!row)throw err(404,'ticket_not_found');
  }else row=await lookup(db,body.ticketId,user.email);
  if(endpoint==='ticket'){
    const data=await db.prepare('SELECT id,author_kind,content,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at DESC LIMIT 50')
      .bind(row.id).all();
    return respond(200,{ticket:projection(row),messages:(data.results||[]).reverse()});
  }
  if(endpoint==='message'){
    const text=safeText(body.message,6000);
    if(!text)throw err(400,'invalid_message');
    if(row.status!=='open')throw err(409,'ticket_closed');
    const time=now(),messageId=crypto.randomUUID();
    const updated=await db.prepare("UPDATE support_tickets SET revision=revision+1,updated_at=? WHERE id=? AND status='open' AND revision=? RETURNING revision")
      .bind(time,row.id,row.revision).first();
    if(!updated)throw err(409,'ticket_conflict');
    await db.prepare('INSERT INTO support_messages(id,ticket_id,author_kind,content,created_at) VALUES (?,?,?,?,?)')
      .bind(messageId,row.id,isAdmin?'expert':'reporter',text,time).run();
    return respond(200,{saved:true,revision:updated.revision,messageId});
  }
  if(endpoint==='close'){
    if(row.status!=='open')throw err(409,'ticket_closed');
    const reason=isAdmin?safeText(body.reason,500):null;
    if(isAdmin&&!reason)throw err(400,'admin_close_reason_required');
    const time=now(),deleteAt=new Date(Date.now()+30*86400000).toISOString();
    const updated=await db.prepare("UPDATE support_tickets SET status='closed',closed_at=?,attachments_delete_at=?,close_reason=?,revision=revision+1,updated_at=? WHERE id=? AND status='open' AND revision=? RETURNING *")
      .bind(time,deleteAt,reason,time,row.id,row.revision).first();
    if(!updated)throw err(409,'ticket_conflict');
    return respond(200,{ticket:projection(updated)});
  }
  if(endpoint==='reopen'){
    if(isAdmin)throw err(403,'admin_cannot_reopen_for_reporter');
    if(row.status!=='closed'||!row.closed_at||
       Date.now()-Date.parse(row.closed_at)>7*86400000)throw err(409,'reopen_window_closed');
    const time=now();
    const updated=await db.prepare("UPDATE support_tickets SET status='open',closed_at=NULL,attachments_delete_at=NULL,revision=revision+1,updated_at=? WHERE id=? AND owner_email=? AND status='closed' AND revision=? RETURNING *")
      .bind(time,row.id,user.email,row.revision).first();
    if(!updated)throw err(409,'ticket_conflict');
    return respond(200,{ticket:projection(updated)});
  }
  if(endpoint==='triage'){
    const latest=await db.prepare("SELECT content FROM support_messages WHERE ticket_id=? AND author_kind='reporter' ORDER BY created_at DESC LIMIT 1")
      .bind(row.id).first();
    if(!latest?.content)throw err(409,'missing_report');
    return respond(200,{ticketId:row.id,triage:triageSupportCase({
      ticketKind:row.kind,text:latest.content,locale:body.locale==='en'?'en':'fa'
    })});
  }
  return respond(404,{error:'not_found'});
 }catch(error){return responseError(error);}
}
export async function supportHealth(env,{fetchImpl=fetch}={}){
 const configurationReady=env?.SUPPORT_TICKETS_ENABLED==='true';
 const bindingReady=!!(env?.SUPPORT_DB&&typeof env.SUPPORT_DB.prepare==='function');
 let schemaReady=false,accountReady=false,accountProbe='not_checked';
 if(configurationReady&&bindingReady){
   try{
     const schema=await env.SUPPORT_DB.prepare(
       "SELECT count(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('support_tickets','support_messages','support_rate_limits')"
     ).first();
     schemaReady=Number(schema?.total)===3;
   }catch{schemaReady=false;}
   if(schemaReady){
     try{
       const response=await fetchImpl('https://game-scam-guard-connected.vercel.app/api/game-scam-guard/auth/status',{
         method:'GET',headers:{accept:'application/json','cache-control':'no-store'}
       });
       accountProbe=response.ok?'http_ok':'http_'+String(response.status||'unknown');
       if(response.ok){
         const account=await response.json();
         accountReady=account?.configured===true&&account?.persistentAccounts===true;
         if(!accountReady)accountProbe='provider_not_configured';
       }
     }catch{accountReady=false;accountProbe='request_failed';}
   }
 }
 // Browser availability depends on our own DB and feature flag.
 // A momentary upstream auth-health outage must not disable ticket UI;
 // the sign-in request itself will fail closed if the provider is unavailable.
 const active=configurationReady&&bindingReady&&schemaReady;
 return respond(200,{
   enabled:active,phase:active?'account-tickets-d1':'not_ready',
   reason:active?null:'support_backend_not_ready',accountOnly:false,emailCodeEnabled:active&&accountReady,
   guestLinksEnabled:false,attachmentsEnabled:false,aiEnabled:false,adminEnabled:false,
   checks:{config:configurationReady,dbBinding:bindingReady,dbSchema:schemaReady,accountProvider:accountReady,accountProbe},
   turnstileSiteKey:null,
   ...supportAdvancedHealth(env),...attachmentHealth(env)
 });
}
