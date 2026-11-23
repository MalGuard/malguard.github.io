// MalGuard Support Ticket workspace. Session tokens stay only in page memory.
(() => {
'use strict';
const $=id=>document.getElementById(id), FA='fa';
let lang=FA, accountToken=null, ticketToken=null, adminToken=null, adminChallengeId=null, emailChallenge=null, requestedTicketId=null, currentTicket=null, busy=false, captchaReady=false;
let siteKey=null, captchaCreate=null, captchaLink=null, selectedId=null;
const publicHosts=new Set(['malguard.site','www.malguard.site','malguard.github.io']);
// Ticket service is hosted on Cloudflare Pages. Do not send report data to
// unrelated Vercel APIs until an authenticated backend is explicitly connected.
const apiBase='';
const authBase=publicHosts.has(location.hostname)?'https://api.malguard.site':'';
const i18n={
  eyebrow:['مرکز پشتیبانی','Support center'],headline:['مشکل رو دقیق‌تر حل کنیم.','Let’s resolve the issue.'],
  intro:['گزارش خصوصی، سابقه گفتگو و پیگیری مرحله‌به‌مرحله.','Private tickets, conversation history, and clear progress.'],
  checking:['در حال بررسی دسترسی سرویس…','Checking service availability…'],
  signInHead:['ورود با حساب MalGuard','Sign in with MalGuard'],
  signinHint:['با حساب MalGuard وارد شو یا با کد ایمیلی، هویتت رو تأیید کن. نشست فقط در حافظه همین صفحه می‌مونه.','Sign in with MalGuard or verify your email with a one-time code. Sessions stay in page memory only.'],
  email:['ایمیل','Email'],password:['رمز عبور','Password'],signinButton:['ورود','Sign in'],or:['یا','or'],
  ticketCode:['شناسه تیکت (اختیاری)','Ticket ID (optional)'],linkEmail:['ایمیل برای دریافت کد ورود','Email for verification code'],
  codeLabel:['کد شش‌رقمی ارسال‌شده به ایمیل','Six-digit email verification code'],
  verifyEmail:['تأیید ایمیل و ورود به تیکت‌ها','Verify email and access tickets'],
  sendLink:['دریافت کد ایمیلی ۶ رقمی','Send a six-digit email code'],logout:['خروج','Sign out'],
  myTickets:['تیکت‌های من','My tickets'],refresh:['بروزرسانی','Refresh'],
  loginToList:['برای مشاهده تیکت‌ها وارد حساب شو.','Sign in to see your tickets.'],
  privateSupport:['خصوصی · پشتیبانی','PRIVATE · SUPPORT'],conversation:['گزارش و گفتگو','Report and conversation'],
  newTicket:['گزارش جدید','New report'],newIntro:['مشکل رو با جزئیات توضیح بده. برای مسائل امنیتی از مسیر جداگانه گزارش امنیتی استفاده کن.','Describe the issue clearly. Use the dedicated private route for security reports.'],
  kind:['نوع گزارش','Report type'],bug:['باگ','Bug'],falsePositive:['تشخیص اشتباه','False positive'],
  feedback:['پیشنهاد یا بازخورد','Feedback'],contact:['ایمیل تماس (برای مهمان)','Email (for guests)'],
  subject:['موضوع','Subject'],details:['شرح مشکل','Details'],route:['مسیر بررسی','Support route'],
  agentRoute:['ایجنت پشتیبانی (در صورت فعال بودن)','Support Agent (when enabled)'],
  expertRoute:['کارشناس انسانی','Human expert'],
  noSecrets:['رمز، توکن، اطلاعات شخصی دیگران یا فایل خطرناک نفرست. پیوست‌ها بعد از آماده‌شدن بررسی امن فایل فعال می‌شن.','Never send passwords, tokens, other people’s data, or dangerous files. Attachments remain unavailable until safe processing is ready.'],
  sendReport:['ثبت گزارش','Submit report'],close:['بستن','Close'],reopen:['بازگشایی','Reopen'],
  new:['تیکت جدید','New ticket'],reply:['پاسخ','Reply'],replyPlaceholder:['پیامت رو بنویس…','Write your reply…'],
  send:['ارسال','Send'],disclaimer:['پاسخ AI به معنای رفع قطعی باگ نیست. تغییر کد و انتشار نیاز به تأیید مدیر داره.','AI advice does not prove a fix. Code changes and releases require owner approval.'],
  existingReport:['فرم گزارش فعلی','Existing reporting form'],
  offline:['در این لحظه اتصال به سرویس تیکت برقرار نشد. دوباره تلاش کن.','Could not reach the ticket service right now. Please retry.'],
  retry:['بررسی دوباره اتصال','Retry connection'],
  codeSent:['درخواست کد پذیرفته شد. ایمیلت رو بررسی کن. کد فقط ۱۰ دقیقه اعتبار داره.','Code request was accepted. Check your email; the code expires in 10 minutes.'],
  codeInvalid:['کد نامعتبر، منقضی یا بیش از حد امتحان شده است. کد جدید درخواست کن.','Code invalid, expired, or tried too many times. Request a new code.'],
  signInFirst:['اول با حساب MalGuard یا کد ایمیلی وارد شو.','Sign in with MalGuard or an email code first.'],
  missingBackend:['صفحه روی Cloudflare آماده‌ست، اما بخش سروری تیکت هنوز پیکربندی نشده.','The Cloudflare page is online, but the ticket backend is not configured yet.'],
  reportNow:['رفتن به فرم ثبت گزارش','Open the working report form'],
  online:['سرویس تیکت حساب‌های MalGuard فعاله. برای ثبت گزارش وارد حسابت شو.','MalGuard account tickets are available. Sign in to create a report.'],
  loginSuccess:['با موفقیت وارد شدی.','You are signed in.'],
  notAvailable:['این قابلیت در حال حاضر در دسترس نیست.','This feature is currently unavailable.'],
  invalidLogin:['ورود تأیید نشد. ایمیل و رمز رو بررسی کن.','Sign-in failed. Check your email and password.'],
  sentLink:['درخواست ارسال کد پذیرفته شد. ایمیلت رو بررسی کن؛ تحویل قطعی تأیید نشده.','The email provider accepted the code request; delivery is not yet confirmed.'],
  accepted:['تیکت ثبت شد.','Ticket accepted.'],
  deliveryAccepted:['سرویس ایمیل پیام رو پذیرفت؛ تحویل به صندوق دریافت هنوز تأیید نشده.','Mail provider accepted the message; delivery is not confirmed.'],
  deliveryUnknown:['تحویل ایمیل تأیید نشد. شناسه تیکت رو نگه دار و از مسیر فعلی هم پیگیری کن.','Email delivery was not confirmed. Keep your ticket ID and use the existing reporting route if needed.'],
  error:['درخواست تأیید نشد. دوباره بررسی کن.','Request could not be confirmed. Please check and retry.'],
  expired:['این لینک استفاده شده یا منقضی شده؛ لینک تازه درخواست کن.','This link was used or expired. Request a new link.'],
  noTickets:['تیکتی برای این حساب پیدا نشد.','No tickets found for this account.'],
  reporter:['گزارش‌دهنده','Reporter'],agent:['ایجنت پشتیبانی','Support Agent'],expert:['کارشناس','Human expert'],
  saved:['پیام ذخیره شد.','Message saved.'],closed:['تیکت بسته شد.','Ticket closed.'],
  reopened:['تیکت دوباره باز شد.','Ticket reopened.'],confirmClose:['این تیکت بسته بشه؟','Close this ticket?'],
  wait:['در حال انجام درخواست…','Request in progress…'],
  accountFirst:['برای دیدن لیست کامل تیکت‌ها با حساب MalGuard وارد شو.','Use your MalGuard account to view all your tickets.']
};
const t=key=>(i18n[key]||[key,key])[lang==='fa'?0:1];
const isUuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'');
const normalizeOtp=value=>Array.from(String(value||'').trim(),ch=>ch>='۰'&&ch<='۹'?String(ch.charCodeAt(0)-1776):ch>='٠'&&ch<='٩'?String(ch.charCodeAt(0)-1632):ch).join('');
let serviceReason=null,serviceEnabled=false,attachmentUi=null,aiReady=false,adminAvailable=false,latestReporterText=null,aiPreviewDigest=null;
function translate(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  $('lang').textContent=lang==='fa'?'English':'فارسی';
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder);});
}
function flash(message,type=''){const el=$('flash');el.textContent=message;el.className='flash '+type;}
function setReady(ready,reason=serviceReason){
  serviceEnabled=ready;
  serviceReason=reason;
  const banner=$('serviceBanner');
  banner.replaceChildren();
  const copy=document.createElement('span');
  copy.textContent=t(ready?'online':reason==='support_backend_not_connected'?'missingBackend':'offline');
  banner.append(copy);
  if(!ready){
    const link=document.createElement('a');
    link.href='/report.html?kind=bug';
    link.textContent=t('reportNow');
    link.className='service-fallback';
    banner.append(link);
    const retry=document.createElement('button');
    retry.type='button';retry.className='secondary service-retry';
    retry.textContent=t('retry');
    retry.addEventListener('click',()=>{retry.disabled=true;void verifyStatus();});
    banner.append(retry);
  }
  banner.className='notice '+(ready?'good':'bad');
  $('linkForm').hidden=!ready||!!accountToken;
  $('guestEmail').disabled=ready;
  $('guestEmail').closest('label').hidden=ready;
  for(const id of ['accountSubmit','linkSubmit','createSubmit','refresh'])
    $(id).disabled=!ready||(id==='createSubmit'&&!accountToken);
}
async function request(url,body,token){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  try {
    const response=await fetch(url,{method:body?'POST':'GET',credentials:'omit',
      headers:body?{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})}:{},
      body:body?JSON.stringify(body):undefined,signal:controller.signal,redirect:'error',cache:'no-store'});
    const raw=await response.text();
    if(raw.length>65536)throw Error('large_response');
    let data;try{data=JSON.parse(raw);}catch{throw Error('invalid_response');}
    if(!response.ok)throw Object.assign(Error(data?.error||'api_failed'),{status:response.status});
    return data;
  } finally{clearTimeout(timeout);}
}
const support=(endpoint,body,token)=>request(apiBase+'/api/support/'+endpoint,body,token);
const auth=(endpoint,body)=>support('auth/'+endpoint,body);
async function verifyStatus(){
  try{
    const status=await support('status');
    setReady(status.enabled===true,status.reason||null);
    aiReady=serviceEnabled&&status.aiEnabled===true;
    adminAvailable=serviceEnabled&&status.adminEnabled===true;
    if(serviceEnabled && status.attachmentsEnabled===true && !attachmentUi){
      import('/assets/support-attachments-ui.mjs').then(m=>{
        attachmentUi=m.initSupportAttachments({request:support,getTicket:()=>currentTicket,
          getToken:token,getLanguage:()=>lang,onError:error=>flash(safeError(error),'error')});
        if(currentTicket)attachmentUi.show();
      }).catch(()=>{flash(t('notAvailable'),'error');});
    }
    if(serviceEnabled && typeof status.turnstileSiteKey==='string') {
      siteKey=status.turnstileSiteKey;
      addTurnstile();
    }
  }catch{setReady(false,'status_request_failed');}
}
function addTurnstile(){
  if(!siteKey||captchaReady||document.getElementById('support-turnstile-script'))return;
  const script=document.createElement('script');script.id='support-turnstile-script';
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.defer=true;script.onload=()=>{
    if(!window.turnstile)return;
    captchaReady=true;
    try{
      captchaCreate=window.turnstile.render('#createCaptcha',{sitekey:siteKey,action:'support_create',theme:'dark'});
      captchaLink=window.turnstile.render('#linkCaptcha',{sitekey:siteKey,action:'support_request_link',theme:'dark'});
    }catch{captchaReady=false;}
  };document.head.append(script);
}
const challengeToken=widget=>captchaReady&&window.turnstile?window.turnstile.getResponse(widget):'';
function resetChallenge(widget){if(widget!=null&&captchaReady)try{window.turnstile.reset(widget);}catch{}}
function token(){return adminToken||ticketToken||accountToken;}
function signedIn(){
  $('identity').hidden=false;
  $('who').textContent=adminToken?'MalGuard Support Admin':accountToken?$('accountEmail').value:(currentTicket?.id||'Ticket session');
  $('ownerPanel').hidden=!(accountToken&&adminAvailable&&new URLSearchParams(location.search).has('owner'));
  $('adminCodeStart').disabled=!serviceEnabled;
  $('accountForm').hidden=!!accountToken;
  $('emailVerifyForm').hidden=true;
  $('createSubmit').disabled=!serviceEnabled||!accountToken;
  $('linkForm').hidden=!!accountToken;
}
function signedOut(){
  accountToken=null;ticketToken=null;adminToken=null;adminChallengeId=null;emailChallenge=null;requestedTicketId=null;selectedId=null;currentTicket=null;
  $('identity').hidden=true;$('createSubmit').disabled=true;$('ownerPanel').hidden=true;$('adminVerifyBox').hidden=true;
  $('adminCode').value='';$('adminState').textContent='';$('accountForm').hidden=false;$('linkForm').hidden=!serviceEnabled;$('emailVerifyForm').hidden=true;
  $('agentAdvice').hidden=true;$('triagePanel').hidden=true;aiPreviewDigest=null;
  $('ticketList').replaceChildren();$('newTicketPane').hidden=false;$('chatPane').hidden=true;
  $('accountPassword').value='';$('reply').value='';attachmentUi?.hide();
}
function renderTickets(rows){
  const el=$('ticketList');el.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.textContent=t('noTickets');p.className='muted';el.append(p);return;}
  for(const row of rows){
    const b=document.createElement('button');b.type='button';
    b.className='ticket-choice'+(row.id===selectedId?' active':'');
    b.textContent=row.subject||row.id;
    const sm=document.createElement('small');sm.dir='ltr';sm.textContent=(row.status||'open')+' · '+row.id.slice(0,8);b.append(sm);
    b.addEventListener('click',()=>openTicket(row.id));el.append(b);
  }
}
async function refresh(){
  if(!accountToken&&!adminToken){flash(t('accountFirst'));return;}
  try{renderTickets((await support('list',{},token())).tickets||[]);}
  catch(error){flash(safeError(error),'error');}
}
function safeError(error){
  if(error?.status===503)return t('notAvailable');
  if(error?.status===401)return t('expired');
  return t('error');
}
function displayChat(ticket,messages){
  currentTicket=ticket;selectedId=ticket.id;
  $('newTicketPane').hidden=true;$('chatPane').hidden=false;
  $('ticketState').textContent=ticket.status;
  $('selectedTitle').textContent=(ticket.subject||ticket.id)+' · '+ticket.id.slice(0,8);
  $('askExpert').hidden=ticket.status==='closed'||ticket.routing!=='agent';
  $('closeTicket').disabled=ticket.status==='closed';
  $('closeTicket').hidden=ticket.status==='closed';
  $('reopenTicket').hidden=ticket.status!=='closed'||!!adminToken;
  $('reply').disabled=ticket.status==='closed';
  $('sendReply').disabled=ticket.status==='closed';
  const list=$('messages');list.replaceChildren();
  for(const m of messages){
    const li=document.createElement('li');li.className='msg '+(m.author_kind==='reporter'?'reporter':'');
    const prefix=m.author_kind==='reporter'?t('reporter'):m.author_kind==='support-agent'?t('agent'):t('expert');
    const small=document.createElement('small');small.textContent=prefix+' · '+(m.created_at||'');
    const content=document.createElement('div');content.textContent=m.content;
    li.append(content,small);list.append(li);
  }
  list.scrollTop=list.scrollHeight;
  latestReporterText=messages.at(-1)?.author_kind==='reporter'?messages.at(-1).content:null;
  $('agentAdvice').hidden=!(aiReady&&ticket.status!=='closed'&&ticket.kind==='bug'&&ticket.routing==='agent'&&latestReporterText);
  $('agentPreviewBox').hidden=true;$('agentConsent').checked=false;
  $('agentSend').disabled=true;aiPreviewDigest=null;
  $('triagePanel').hidden=!serviceEnabled;
  $('triageNotice').textContent='';
  $('triageDetails').replaceChildren();
  attachmentUi?.show();
}
async function showTriage() {
  const id=currentTicket?.id,locale=lang;
  if(!serviceEnabled||!isUuid(id)||!token()||$('triagePanel').hidden)return;
  $('triageRefresh').disabled=true;
  $('triageNotice').textContent=locale==='fa'?'در حال بررسی محلی اطلاعات تیکت…':'Checking ticket details locally…';
  try {
    const data=await support('triage',{ticketId:id,locale},token());
    if(currentTicket?.id!==id||lang!==locale)return;
    const triage=data?.triage;
    if(!triage||triage.source!=='deterministic-server-rule'||!Array.isArray(triage.missingDetails)||
      !Array.isArray(triage.safeChecks))throw Error('invalid_triage_response');
    const lines=[];
    if(triage.notice)lines.push(triage.notice);
    if(triage.missingDetails.length)lines.push(
      (locale==='fa'?'اطلاعات تکمیلی: ':'Missing information: ')+triage.missingDetails.join('، '));
    for(const check of triage.safeChecks)lines.push('• '+check);
    if(triage.suggestedFollowUp)lines.push(triage.suggestedFollowUp);
    $('triageDetails').textContent=lines.join('\n');
    $('triageDetails').style.whiteSpace='pre-wrap';
    $('triageNotice').textContent=locale==='fa'
      ?'راهنمای اولیه؛ هیچ مدل خارجی فراخوانی نشد و هیچ تغییری انجام نشد.'
      :'Initial guidance. No external AI was called and no change was made.';
  }catch {
    if(currentTicket?.id===id)$('triageNotice').textContent=locale==='fa'
      ?'عیب‌یابی محلی تأیید نشد؛ می‌تونی به کارشناس ارجاع بدی.'
      :'Local triage was unavailable. You can request human support.';
  }finally{$('triageRefresh').disabled=false;}
}
async function openTicket(id){
  if(!isUuid(id)||!token())return;
  try{
    const data=await support('ticket',{ticketId:id},token());
    displayChat(data.ticket,data.messages||[]);
    void showTriage();
  }catch(error){flash(safeError(error),'error');}
}
async function redeemFragment(){
  const hash=location.hash.slice(1);
  if(!hash)return;
  // Remove the secret before any asynchronous work, analytics, or navigation.
  history.replaceState(null,'',location.pathname+location.search);
  const q=new URLSearchParams(hash),id=q.get('ticket'),credential=q.get('token');
  if(!isUuid(id)||!credential||!/^[A-Za-z0-9_-]{43}$/.test(credential)){flash(t('expired'),'error');return;}
  try{
    const reply=await support('redeem-link',{ticketId:id,token:credential});
    ticketToken=reply.accessToken;accountToken=null;
    signedIn();await openTicket(id);flash('');
  }catch{flash(t('expired'),'error');}
}
$('lang').addEventListener('click',()=>{lang=lang==='fa'?'en':'fa';translate();setReady(serviceEnabled);});
$('accountForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy)return;
  busy=true;$('accountSubmit').disabled=true;flash(t('wait'));
  try{
    const response=await auth('password',{email:$('accountEmail').value.trim(),password:$('accountPassword').value});
    if(typeof response.sessionToken!=='string'||!response.sessionToken)throw Error('invalid_session');
    accountToken=response.sessionToken;ticketToken=null;$('accountPassword').value='';
    signedIn();flash(t('loginSuccess'),'success');await refresh();
  }catch{flash(t('invalidLogin'),'error');}
  finally{busy=false;$('accountSubmit').disabled=false;}
});
$('linkForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy)return;
  const id=$('linkTicketId').value.trim();
  if(id&&!isUuid(id)){flash(t('error'),'error');return;}
  busy=true;$('linkSubmit').disabled=true;flash(t('wait'));
  try{
    const result=await auth('start',{email:$('linkEmail').value.trim()});
    if(!isUuid(result.challengeId))throw Error('invalid_email_response');
    emailChallenge=result.challengeId;requestedTicketId=id||null;
    $('emailVerifyForm').hidden=false;
    $('emailVerifyCode').value='';
    flash(t('codeSent'),'success');
  }catch(error){flash(safeError(error),'error');}
  finally{busy=false;$('linkSubmit').disabled=false;}
});
$('emailVerifyForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy||!emailChallenge)return;
  const code=normalizeOtp($('emailVerifyCode').value);
  if(!/^[0-9]{6}$/.test(code)){flash(t('codeInvalid'),'error');return;}
  busy=true;$('emailVerifySubmit').disabled=true;flash(t('wait'));
  try{
    const result=await auth('verify',{challengeId:emailChallenge,code});
    if(typeof result.sessionToken!=='string'||result.sessionToken.length<20)throw Error('invalid_session');
    accountToken=result.sessionToken;ticketToken=null;emailChallenge=null;
    $('accountEmail').value=$('linkEmail').value.trim();
    $('emailVerifyCode').value='';
    signedIn();flash(t('loginSuccess'),'success');await refresh();
    if(requestedTicketId)await openTicket(requestedTicketId);
    requestedTicketId=null;
  }catch(error){flash(error?.status===400||error?.status===401||error?.status===409?t('codeInvalid'):safeError(error),'error');}
  finally{busy=false;$('emailVerifySubmit').disabled=false;}
});
$('createForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy)return;
  if(!accountToken){flash(t('signInFirst'),'error');return;}
  const captcha=null;
  busy=true;$('createSubmit').disabled=true;flash(t('wait'));
  try{
    const payload={kind:$('kind').value,subject:$('subject').value, message:$('description').value,
      route:document.querySelector('input[name="route"]:checked')?.value||'agent',
      ...(accountToken?{}:{email:$('guestEmail').value.trim(),turnstileToken:captcha})};
    const data=await support('create',payload,accountToken);
    const id=data.ticketId;
    flash(t('accepted')+(id?'\nTicket: '+id:'')+
      (!accountToken?'\n'+(data.delivery==='provider_accepted'?t('deliveryAccepted'):t('deliveryUnknown')):''),'success');
    if(accountToken){$('createForm').reset();await refresh();if(isUuid(id))await openTicket(id);}
    else if(isUuid(id)){$('linkTicketId').value=id;$('linkEmail').value=payload.email;}
  }catch(error){flash(safeError(error),'error');}
  finally{resetChallenge(captchaCreate);busy=false;$('createSubmit').disabled=!serviceEnabled||!accountToken;}
});
$('messageForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy||!currentTicket)return;
  busy=true;$('sendReply').disabled=true;const message=$('reply').value;
  try{
    await support('message',{ticketId:currentTicket.id,message},token());
    $('reply').value='';await openTicket(currentTicket.id);flash(t('saved'),'success');
  }catch(error){flash(safeError(error),'error');}
  finally{busy=false;$('sendReply').disabled=currentTicket?.status==='closed';}
});
$('closeTicket').addEventListener('click',async()=>{
  if(!currentTicket||busy)return;
  let reason;
  if(adminToken){
    reason=prompt(lang==='fa'?'دلیل بسته‌شدن تیکت (اجباری):':'Required reason for closing the ticket:');
    if(typeof reason!=='string'||reason.trim().length<1||reason.length>500)return;
  }else if(!confirm(t('confirmClose')))return;
  busy=true;
  try{await support('close',{ticketId:currentTicket.id,...(adminToken?{reason:reason.trim()}:{})},
    token());await openTicket(currentTicket.id);flash(t('closed'),'success');}
  catch(e){flash(safeError(e),'error');}finally{busy=false;}
});
$('reopenTicket').addEventListener('click',async()=>{
  if(!currentTicket||busy)return;
  busy=true;
  try{await support('reopen',{ticketId:currentTicket.id},token());await openTicket(currentTicket.id);flash(t('reopened'),'success');}
  catch(e){flash(safeError(e),'error');}finally{busy=false;}
});

$('agentPrepare').addEventListener('click',async()=>{
  if(!latestReporterText||!currentTicket||!aiReady)return;
  try{
    const {redactLog}=await import('/assets/support-privacy.mjs');
    const candidate=redactLog(latestReporterText.slice(0,4000)).redacted;
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate));
    aiPreviewDigest=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
    $('agentPreviewText').value=candidate;
    $('agentPreviewBox').hidden=false;
    $('agentConsent').checked=false;$('agentSend').disabled=true;
  }catch{flash(t('error'),'error');}
});
$('agentConsent').addEventListener('change',()=>{
  $('agentSend').disabled=!$('agentConsent').checked||!aiPreviewDigest;
});
$('agentSend').addEventListener('click',async()=>{
  if(!aiReady||!latestReporterText||!currentTicket||!aiPreviewDigest||
     !$('agentConsent').checked||busy)return;
  busy=true;$('agentSend').disabled=true;
  try{
    await support('agent',{ticketId:currentTicket.id,consent:true,
      previewSha:aiPreviewDigest,locale:lang},token());
    await openTicket(currentTicket.id);
    flash(lang==='fa'?'پاسخ اولیه ایجنت ثبت شد؛ این پاسخ به معنی رفع قطعی باگ نیست.':'Agent guidance was saved; it does not prove the bug is fixed.','success');
  }catch(error){flash(safeError(error),'error');}
  finally{busy=false;}
});
$('askExpert').addEventListener('click',async()=>{
  if(!currentTicket||currentTicket.status==='closed'||currentTicket.routing!=='agent'||busy)return;
  if(!confirm(lang==='fa'?'این تیکت برای بررسی انسانی به صف کارشناس منتقل بشه؟':'Escalate this ticket for human support?'))return;
  busy=true;$('askExpert').disabled=true;
  try{
    const result=await support('escalate',{ticketId:currentTicket.id},token());
    await openTicket(currentTicket.id);
    flash(result.expertNotification==='provider_accepted'
      ?(lang==='fa'?'درخواست کارشناسی ثبت شد؛ سرویس ایمیل اعلان رو پذیرفت، تحویل قطعی نیست.':'Human support requested; mail provider accepted notification, delivery is unconfirmed.')
      :(lang==='fa'?'درخواست کارشناسی ثبت شد ولی ارسال اعلان تأیید نشد.':'Human support requested, but delivery of notification was unconfirmed.'),'success');
  }catch(error){flash(safeError(error),'error');}
  finally{busy=false;$('askExpert').disabled=false;}
});
$('triageRefresh').addEventListener('click',()=>{void showTriage();});
$('newTicket').addEventListener('click',()=>{currentTicket=null;selectedId=null;$('chatPane').hidden=true;$('newTicketPane').hidden=false;$('ticketState').textContent=t('newTicket');$('agentAdvice').hidden=true;$('triagePanel').hidden=true;attachmentUi?.hide();flash('');});
$('refresh').addEventListener('click',refresh);
$('adminCodeStart').addEventListener('click',async()=>{
  if(!accountToken||busy)return;
  busy=true;$('adminCodeStart').disabled=true;
  try{
    const result=await support('admin-code-start',{},accountToken);
    adminChallengeId=result.challengeId;
    $('adminVerifyBox').hidden=false;
    $('adminState').textContent=lang==='fa'?'کد موقت به ایمیل مدیر ارسال شد؛ تحویل نهایی تضمین‌شده نیست.':'Code accepted by the provider; delivery is not guaranteed.';
  }catch(e){$('adminState').textContent=safeError(e);}
  finally{busy=false;$('adminCodeStart').disabled=false;}
});
$('adminCodeVerify').addEventListener('click',async()=>{
  if(!accountToken||!adminChallengeId||busy)return;
  busy=true;$('adminCodeVerify').disabled=true;
  try{
    const result=await support('admin-code-verify',{challengeId:adminChallengeId,
      code:normalizeOtp($('adminCode').value)},accountToken);
    if(typeof result.accessToken!=='string'||result.accessToken.length<20)throw Error('invalid_response');
    adminToken=result.accessToken;ticketToken=null;adminChallengeId=null;
    $('adminCode').value='';$('adminVerifyBox').hidden=true;
    $('adminState').textContent=lang==='fa'?'دسترسی مدیر برای ۱۵ دقیقه فعال شد.':'Owner access is active for 15 minutes.';
    signedIn();await refresh();
  }catch(e){$('adminState').textContent=safeError(e);}
  finally{busy=false;$('adminCodeVerify').disabled=false;}
});
$('logout').addEventListener('click',()=>{signedOut();flash('');});
window.addEventListener('pagehide',()=>{accountToken=null;ticketToken=null;adminToken=null;adminChallengeId=null;});
translate();setReady(false);verifyStatus().then(redeemFragment);
})();
