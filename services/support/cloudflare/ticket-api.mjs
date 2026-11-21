// MalGuard Support tickets on Cloudflare Pages + D1.
// Uses the existing MalGuard email-account API to verify a signed account session.
// No duplicate account records, no secret API keys in the browser, fail closed on missing DB.
import {triageSupportCase} from '../server/support-triage.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED=new Set(['bug','false-positive','feedback']);
const ROUTES=new Set(['agent','expert']);
const now=()=>new Date().toISOString();
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?
  value.toLowerCase():null;
const err=(status,code)=>Object.assign(new Error(code),{status,code});
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
 const db=getDb(env),source=request.headers.get('cf-connecting-ip')||
   request.headers.get('x-real-ip')||'unspecified';
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
 const url='https://api.malguard.site/api/game-scam-guard/auth/'+path;
 let res;
 try{res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(body),redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(12000)});}
 catch{throw err(503,'account_provider_unavailable');}
 const raw=await res.text().catch(()=>'');
 if(raw.length>24000)throw err(502,'account_provider_unavailable');
 if(!res.ok)throw err(res.status===401?401:res.status===429?429:503,
   res.status===401?'invalid_account_session':'account_provider_unavailable');
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
    const result=await callAuth('start',{email:address});
    if(typeof result?.verificationToken!=='string'||result.verificationToken.length<32||
      result.verificationToken.length>12000)throw err(503,'account_provider_unavailable');
    return respond(200,{verificationToken:result.verificationToken,delivery:'provider_accepted'});
  }
  if(endpoint==='auth/verify'){
    const body=await decodeRequest(request,14000);
    if(typeof body.verificationToken!=='string'||body.verificationToken.length<32||
      body.verificationToken.length>12000||typeof body.code!=='string'||!/^[0-9]{6}$/.test(body.code))
      throw err(400,'invalid_verification');
    await rate(env,request,'email-login-verify',10,900000);
    const result=await callAuth('verify',{verificationToken:body.verificationToken,code:body.code});
    if(typeof result?.sessionToken!=='string'||result.sessionToken.length<20)
      throw err(503,'account_provider_unavailable');
    return respond(200,{sessionToken:result.sessionToken});
  }
  if(!['create','list','ticket','message','close','reopen','triage'].includes(endpoint))
    return respond(503,{error:'feature_not_configured'});
  const body=await decodeRequest(request);
  const user=await actor(request);
  await rate(env,request,'tickets',100,3600000);
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
    const data=await db.prepare('SELECT * FROM support_tickets WHERE owner_email=? ORDER BY created_at DESC LIMIT 50')
      .bind(user.email).all();
    return respond(200,{tickets:(data.results||[]).map(projection)});
  }
  const row=await lookup(db,body.ticketId,user.email);
  if(endpoint==='ticket'){
    const data=await db.prepare('SELECT id,author_kind,content,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at DESC LIMIT 50')
      .bind(row.id).all();
    return respond(200,{ticket:projection(row),messages:(data.results||[]).reverse()});
  }
  if(endpoint==='message'){
    const text=safeText(body.message,6000);
    if(!text)throw err(400,'invalid_message');
    if(row.status!=='open')throw err(409,'ticket_closed');
    const time=now();
    const updated=await db.prepare("UPDATE support_tickets SET revision=revision+1,updated_at=? WHERE id=? AND owner_email=? AND status='open' AND revision=? RETURNING revision")
      .bind(time,row.id,user.email,row.revision).first();
    if(!updated)throw err(409,'ticket_conflict');
    await db.prepare('INSERT INTO support_messages(id,ticket_id,author_kind,content,created_at) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(),row.id,'reporter',text,time).run();
    return respond(200,{saved:true,revision:updated.revision});
  }
  if(endpoint==='close'){
    if(row.status!=='open')throw err(409,'ticket_closed');
    const time=now(),deleteAt=new Date(Date.now()+30*86400000).toISOString();
    const updated=await db.prepare("UPDATE support_tickets SET status='closed',closed_at=?,attachments_delete_at=?,revision=revision+1,updated_at=? WHERE id=? AND owner_email=? AND status='open' AND revision=? RETURNING *")
      .bind(time,deleteAt,time,row.id,user.email,row.revision).first();
    if(!updated)throw err(409,'ticket_conflict');
    return respond(200,{ticket:projection(updated)});
  }
  if(endpoint==='reopen'){
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
 const binding=env?.SUPPORT_TICKETS_ENABLED==='true'&&
  !!(env?.SUPPORT_DB&&typeof env.SUPPORT_DB.prepare==='function');
 let active=false;
 if(binding){
   try{
     const schema=await env.SUPPORT_DB.prepare(
       "SELECT count(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('support_tickets','support_messages','support_rate_limits')"
     ).first();
     if(schema?.total===3){
       const response=await fetchImpl('https://api.malguard.site/api/game-scam-guard/auth/status',{
         method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(6000)
       });
       if(response.ok){
         const account=await response.json();
         active=account?.configured===true&&account?.persistentAccounts===true;
       }
     }
   }catch{active=false;}
 }
 return respond(200,{
   enabled:active,phase:active?'account-tickets-d1':'database_not_connected',
   reason:active?null:'support_database_not_connected',accountOnly:false,emailCodeEnabled:active,guestLinksEnabled:false,
   attachmentsEnabled:false,aiEnabled:false,adminEnabled:false,
   turnstileSiteKey:null
 });
}
