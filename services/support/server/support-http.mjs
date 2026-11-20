import {createHmac} from 'node:crypto';
import {createSupportStore} from './support-store.mjs';
import {createSupportAdmin} from './support-admin.mjs';
import {createSupportIdentity} from './support-identity.mjs';
import {createSupportMailer,createChallengeVerifier} from './support-mail.mjs';
import {issueEmailLink} from './email-link.mjs';
import {createUploadService} from './support-upload.mjs';
import {createSupportModel,previewSupportText} from './support-model.mjs';
import {canAccessTicket,closeTicket,reopenTicket,TicketPolicyError} from './ticket-policy.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS=new Set(['bug','false-positive','feedback']);
const ENDPOINTS=new Set(['escalate','status','admin-code-start','admin-code-verify','agent','create','list','ticket','message','close','reopen','request-link','redeem-link',
 'attachment-list','attachment-start','attachment-chunk','attachment-finish','attachment-approve','attachment-revoke']);
const ORIGINS=new Set(['https://malguard.site','https://www.malguard.site','https://malguard.github.io']);
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const mail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=value=>mail(value).length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail(value));
const nonEmpty=(value,max)=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=max;
const policyRow=row=>({id:row.id,ownerEmail:row.owner_email,status:row.status,revision:row.revision,
  createdAt:row.created_at,closedAt:row.closed_at,attachmentsDeleteAt:row.attachments_delete_at});
const outputRow=row=>({id:row.id,kind:row.kind,routing:row.routing,subject:row.subject,status:row.status,
  revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,
  closedAt:row.closed_at,attachmentsDeleteAt:row.attachments_delete_at});
const result=(res,status,data)=>{
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

export function createSupportHandler({
  store=createSupportStore(),upload=createUploadService(),model=createSupportModel(),identity=createSupportIdentity(),
  mailer=createSupportMailer(),challenge=createChallengeVerifier(),admin,
  enabled=process.env.SUPPORT_API_ENABLED==='true',
  rateSecret=process.env.SUPPORT_SESSION_SECRET,
  publicSiteKey=process.env.SUPPORT_TURNSTILE_SITE_KEY,
  now=()=>Date.now()
}={}) {
  const rateReady=typeof rateSecret==='string'&&rateSecret.length>=32;
  const adminAccess=admin||createSupportAdmin({store,mailer});
  const configured=enabled&&store.enabled&&identity.enabled&&mailer.enabled&&challenge.enabled&&rateReady&&typeof publicSiteKey==='string'&&publicSiteKey.length>=10;
  async function takeRate(value,limit,seconds) {
    if(!rateReady)throw fail(503,'support_unavailable');
    const key=createHmac('sha256',rateSecret).update(value).digest('hex');
    if(await store.takeRate(key,limit,seconds)!==true)throw fail(429,'rate_limited');
  }
  function bodyOf(req,endpoint) {
    const max=endpoint==='attachment-chunk'?750000:16384;
    let raw=req.body;
    if(typeof raw==='string') {
      if(Buffer.byteLength(raw)>max)throw fail(413,'request_too_large');
      try{raw=JSON.parse(raw);}catch{throw fail(400,'invalid_json');}
    }
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw))>max)
      throw fail(400,'invalid_body');
    return raw;
  }
  async function actorOf(req) {
    const header=req.headers?.authorization;
    const match=typeof header==='string'?/^Bearer ([^\s]+)$/.exec(header):null;
    if(!match)throw fail(401,'unauthorized');
    const token=match[1];
    return token.startsWith('mgadm1.')?adminAccess.actorFromToken(token):
      token.startsWith('mgst1.')?identity.linkActor(token):identity.accountActor(token);
  }
  async function privateTicket(id,actor) {
    if(!UUID.test(id||''))throw fail(400,'invalid_ticket');
    const row=await store.ticket(id);
    // Never leak which of missing/forbidden occurred (BOLA prevention).
    if(!row||!canAccessTicket(policyRow(row),actor))throw fail(404,'ticket_not_found');
    return row;
  }
  async function issueAndSend(row) {
    const issued=issueEmailLink({id:row.id,ownerEmail:row.owner_email},now());
    await store.putLink(issued.record);
    await mailer.sendTicketLink({email:row.owner_email,ticketId:row.id,token:issued.token});
  }
  async function dispatch(req,endpoint) {
    if(endpoint==='status')return {enabled:configured,attachmentsEnabled:configured&&upload.available,aiEnabled:configured&&model.ready,adminEnabled:configured&&adminAccess.enabled,phase:'ticket-api',turnstileSiteKey:configured?publicSiteKey:null};
    if(!configured)throw fail(503,'support_unavailable');
    const body=bodyOf(req,endpoint);
    if(endpoint==='admin-code-start'||endpoint==='admin-code-verify'){
      const account=await actorOf(req);
      if(account.method!=='account')throw fail(403,'account_required');
      await takeRate('admin-otp:'+account.email,5,3600);
      if(endpoint==='admin-code-start')return adminAccess.requestCode(account);
      return adminAccess.verifyCode(account,body.challengeId,body.code);
    }
    if(endpoint==='create'){
      if(!KINDS.has(body.kind))throw fail(400,'invalid_report_kind');
      if(!['agent','expert'].includes(body.route))throw fail(400,'invalid_support_route');
      if(!nonEmpty(body.subject,160)||!nonEmpty(body.message,6000))throw fail(400,'invalid_report');
      const hasAuth=typeof req.headers.authorization==='string'&&req.headers.authorization.length>0;
      let actor=null;
      if(hasAuth)actor=await actorOf(req);
      if(actor&&actor.method!=='account')throw fail(403,'account_required_for_authenticated_create');
      const email=actor?actor.email:mail(body.email);
      if(!validEmail(email)||actor&&body.email&&mail(body.email)!==email)
        throw fail(400,'invalid_email');
      if(!actor) {
        if(await challenge.verify(body.turnstileToken,'support_create')!==true)throw fail(403,'challenge_failed');
      }
      await takeRate('create:'+email,actor?10:3,3600);
      const id=await store.create({email,accountId:actor?.accountId||null,kind:body.kind,route:body.route,
        subject:body.subject.trim(),message:body.message.trim()});
      let expertNotification='not_requested';
      if(body.route==='expert'){
        expertNotification='unconfirmed';
        try{await mailer.notifyExpert({ticketId:id});expertNotification='provider_accepted';}catch{}
      }
      if(actor)return {accepted:true,ticketId:id,expertNotification};
      // A confirmed ticket-store write is not proof of email delivery.
      let delivery='unconfirmed';
      try{
        await issueAndSend({id,owner_email:email});
        delivery='provider_accepted';
      }catch{}
      return {accepted:true,ticketId:id,delivery,expertNotification};
    }
    if(endpoint==='request-link'){
      if(!UUID.test(body.ticketId||'')||!validEmail(body.email))throw fail(400,'invalid_request');
      if(await challenge.verify(body.turnstileToken,'support_request_link')!==true)
        throw fail(403,'challenge_failed');
      const email=mail(body.email);
      await takeRate('link-email:'+email,3,3600);
      await takeRate('link-ticket:'+body.ticketId,6,3600);
      const row=await store.ticket(body.ticketId);
      if(row?.owner_email===email) {
        try{await issueAndSend(row);}catch{}
      }
      // Always non-enumerating, even when the mail provider rejects delivery.
      return {accepted:true,message:'If the details match, a link may be sent.'};
    }
    if(endpoint==='redeem-link'){
      if(!UUID.test(body.ticketId||'')||typeof body.token!=='string'||
         !/^[A-Za-z0-9_-]{43}$/.test(body.token))throw fail(401,'unauthorized');
      await takeRate('redeem:'+body.ticketId,20,3600);
      const {createHash}=await import('node:crypto');
      const digest=createHash('sha256').update(body.token).digest('hex');
      const redemption=await store.redeem(body.ticketId,digest);
      if(!redemption||redemption.ticketId!==body.ticketId||!validEmail(redemption.email))
        throw fail(401,'unauthorized');
      return identity.issueTicketSession({ticketId:redemption.ticketId,email:redemption.email});
    }
    const actor=await actorOf(req);
    if(endpoint==='list') {
      if(!['account','admin'].includes(actor.method))throw fail(403,'account_required');
      await takeRate('list:'+actor.email,60,3600);
      const rows=actor.method==='admin'?await store.listAll():await store.listByEmail(actor.email);
      return {tickets:rows.map(outputRow)};
    }
    const row=await privateTicket(body.ticketId,actor);
    if(endpoint==='ticket'){
      await takeRate('ticket-read:'+actor.email,120,3600);
      return {ticket:outputRow(row),messages:await store.messages(row.id)};
    }
    if(endpoint.startsWith('attachment-')){
      if(actor.method==='admin' && !['attachment-list','attachment-revoke'].includes(endpoint))
        throw fail(403,'reporter_consent_required');
      if(endpoint==='attachment-list'){
        await takeRate('attachment-list:'+actor.email,60,3600);
        return upload.list(row.id);
      }
      if(row.status==='closed'&&endpoint!=='attachment-revoke')throw fail(409,'ticket_closed');
      await takeRate('attachment-operations:'+actor.email,120,3600);
      if(endpoint==='attachment-start')return upload.begin(row.id,body);
      if(endpoint==='attachment-chunk')return upload.chunk(row.id,body);
      if(endpoint==='attachment-finish')return upload.finish(row.id,body);
      if(endpoint==='attachment-approve')return upload.approve(row.id,body);
      if(endpoint==='attachment-revoke')return upload.revoke(row.id,body);
    }

    if(endpoint==='escalate'){
      if(actor.method==='admin')throw fail(403,'reporter_only');
      if(row.status==='closed'||row.routing!=='agent')throw fail(409,'escalation_unavailable');
      await takeRate('expert-handoff:'+actor.email,10,3600);
      const updated=await store.escalate(row.id,row.revision);
      let expertNotification='unconfirmed';
      try{await mailer.notifyExpert({ticketId:row.id});expertNotification='provider_accepted';}catch{}
      return {ticket:outputRow(updated),expertNotification};
    }
    if(endpoint==='agent'){
      if(actor.method==='admin')throw fail(403,'reporter_consent_required');
      if(!model.ready)throw fail(503,'support_ai_unavailable');
      if(row.status==='closed'||row.kind!=='bug'||row.routing!=='agent')
        throw fail(409,'agent_not_available_for_ticket');
      if(body.consent!==true||!/^[a-f0-9]{64}$/.test(body.previewSha||''))
        throw fail(403,'model_sharing_consent_required');
      await takeRate('agent:'+actor.email,5,3600);
      const messages=await store.messages(row.id);
      const latest=messages.at(-1);
      if(latest?.author_kind!=='reporter'||typeof latest.content!=='string')
        throw fail(409,'no_new_report_for_agent');
      const preview=previewSupportText(latest.content);
      if(preview.sha256!==body.previewSha)throw fail(409,'support_preview_changed');
      const reply=await model.respond(latest.content,{
        locale:body.locale==='en'?'en':'fa',approvedSha256:body.previewSha
      });
      const saved=await store.appendAgent(row.id,row.revision,reply.text);
      return {saved:true,text:reply.text,revision:saved?.revision,redactedSha256:reply.redactedSha256};
    }
    if(endpoint==='message'){
      if(!nonEmpty(body.message,6000))throw fail(400,'invalid_message');
      if(row.status==='closed')throw fail(409,'ticket_closed');
      await takeRate('message:'+actor.email,40,3600);
      return {saved:true,...await (actor.method==='admin'?store.appendExpert(row.id,row.revision,body.message.trim()):store.append(row.id,row.revision,body.message.trim()))};
    }
    if(endpoint==='close') {
      closeTicket(policyRow(row),actor,now(),body.reason);
      await takeRate('close:'+actor.email,15,3600);
      return {ticket:outputRow(await store.close(row.id,row.revision,body.reason,actor.method==='admin'?'admin':'reporter'))};
    }
    if(endpoint==='reopen'){
      reopenTicket(policyRow(row),actor,now());
      await takeRate('reopen:'+actor.email,15,3600);
      return {ticket:outputRow(await store.reopen(row.id,row.revision))};
    }
    throw fail(404,'unknown_endpoint');
  }
  return async function supportHandler(req,res) {
    res.setHeader('cache-control','no-store');
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('vary','Origin');
    const origin=req.headers?.origin;
    if(origin && !ORIGINS.has(origin))return result(res,403,{error:'origin_not_allowed'});
    if(origin)res.setHeader('access-control-allow-origin',origin);
    if(req.method==='OPTIONS'){
      const headers=String(req.headers?.['access-control-request-headers']||'')
        .toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
      if(!origin||req.headers?.['access-control-request-method']!=='POST'||
         headers.some(h=>!['authorization','content-type'].includes(h)))
        return result(res,403,{error:'preflight_denied'});
      res.setHeader('access-control-allow-methods','POST');
      res.setHeader('access-control-allow-headers','Authorization, Content-Type');
      return res.end();
    }
    const endpoint=req.query?.endpoint;
    if(typeof endpoint!=='string'||!ENDPOINTS.has(endpoint))
      return result(res,404,{error:'unknown_endpoint'});
    if((endpoint==='status'&&req.method!=='GET')||
       (endpoint!=='status'&&req.method!=='POST'))
      return result(res,405,{error:'method_not_allowed'});
    if(endpoint!=='status' && !/^application\/json(?:\s*;|$)/i.test(String(req.headers?.['content-type']||'')))
      return result(res,415,{error:'json_required'});
    try{return result(res,200,await dispatch(req,endpoint));}
    catch(error){
      const status=error instanceof TicketPolicyError?error.status:
        [400,401,403,404,409,413,429,503].includes(error?.status)?error.status:503;
      const code=typeof error?.code==='string'&&status!==503?error.code:
        status===503?'support_unavailable':'request_failed';
      return result(res,status,{error:code});
    }
  };
}

let singleton;
export default function handler(req,res){
  singleton??=createSupportHandler();
  return singleton(req,res);
}
