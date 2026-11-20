// MalGuard Support Ticket workspace. Session tokens stay only in page memory.
(() => {
'use strict';
const $=id=>document.getElementById(id), FA='fa';
let lang=FA, accountToken=null, ticketToken=null, currentTicket=null, busy=false, captchaReady=false;
let siteKey=null, captchaCreate=null, captchaLink=null, selectedId=null;
const publicHosts=new Set(['malguard.site','www.malguard.site','malguard.github.io']);
const apiBase=publicHosts.has(location.hostname)?'https://api.malguard.site':'';
const authBase=publicHosts.has(location.hostname)?'https://api.malguard.site':'';
const i18n={
  eyebrow:['مرکز پشتیبانی','Support center'],headline:['مشکل رو دقیق‌تر حل کنیم.','Let’s resolve the issue.'],
  intro:['گزارش خصوصی، سابقه گفتگو و پیگیری مرحله‌به‌مرحله.','Private tickets, conversation history, and clear progress.'],
  checking:['در حال بررسی دسترسی سرویس…','Checking service availability…'],
  signInHead:['ورود با حساب MalGuard','Sign in with MalGuard'],
  signinHint:['ورود فقط برای این صفحه معتبره و چیزی روی دستگاه ذخیره نمی‌شه.','This page keeps the session in memory only.'],
  email:['ایمیل','Email'],password:['رمز عبور','Password'],signinButton:['ورود','Sign in'],or:['یا','or'],
  ticketCode:['شناسه تیکت','Ticket ID'],linkEmail:['ایمیل ثبت‌شده در تیکت','Ticket email'],
  sendLink:['دریافت لینک ورود ایمیلی','Send an email access link'],logout:['خروج','Sign out'],
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
  offline:['سرویس تیکت جدید هنوز فعال نشده. از فرم گزارش فعلی استفاده کن.','The new ticket service is not enabled yet. Use the existing report form.'],
  online:['سرویس تیکت در دسترسه.','Ticket service is available.'],
  loginSuccess:['با موفقیت وارد شدی.','You are signed in.'],
  notAvailable:['این قابلیت در حال حاضر در دسترس نیست.','This feature is currently unavailable.'],
  invalidLogin:['ورود تأیید نشد. ایمیل و رمز رو بررسی کن.','Sign-in failed. Check your email and password.'],
  sentLink:['اگه اطلاعات مطابقت داشته باشه، لینک دسترسی به ایمیلت ارسال می‌شه.','If the information matches, an access link may arrive by email.'],
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
let serviceEnabled=false;
function translate(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  $('lang').textContent=lang==='fa'?'English':'فارسی';
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder);});
}
function flash(message,type=''){const el=$('flash');el.textContent=message;el.className='flash '+type;}
function setReady(ready){
  serviceEnabled=ready;
  $('serviceBanner').textContent=t(ready?'online':'offline');
  $('serviceBanner').className='notice '+(ready?'good':'bad');
  for(const id of ['accountSubmit','linkSubmit','createSubmit','refresh'])
    $(id).disabled=!ready;
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
const auth=(endpoint,body)=>request(authBase+'/api/game-scam-guard/auth/'+endpoint,body);
async function verifyStatus(){
  try{
    const status=await support('status');
    setReady(status.enabled===true);
    if(serviceEnabled && typeof status.turnstileSiteKey==='string') {
      siteKey=status.turnstileSiteKey;
      addTurnstile();
    }
  }catch{setReady(false);}
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
function token(){return ticketToken||accountToken;}
function signedIn(){
  $('identity').hidden=false;
  $('who').textContent=accountToken?$('accountEmail').value:(currentTicket?.id||'Ticket session');
  $('accountForm').hidden=!!accountToken;
  $('linkForm').hidden=!!accountToken;
}
function signedOut(){
  accountToken=null;ticketToken=null;selectedId=null;currentTicket=null;
  $('identity').hidden=true;$('accountForm').hidden=false;$('linkForm').hidden=false;
  $('ticketList').replaceChildren();$('newTicketPane').hidden=false;$('chatPane').hidden=true;
  $('accountPassword').value='';$('reply').value='';
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
  if(!accountToken){flash(t('accountFirst'));return;}
  try{renderTickets((await support('list',{},accountToken)).tickets||[]);}
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
  $('closeTicket').disabled=ticket.status==='closed';
  $('closeTicket').hidden=ticket.status==='closed';
  $('reopenTicket').hidden=ticket.status!=='closed';
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
}
async function openTicket(id){
  if(!isUuid(id)||!token())return;
  try{
    const data=await support('ticket',{ticketId:id},token());
    displayChat(data.ticket,data.messages||[]);
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
  const captcha=challengeToken(captchaLink);
  if(!captcha){flash(t('error'),'error');return;}
  busy=true;$('linkSubmit').disabled=true;flash(t('wait'));
  try{
    await support('request-link',{ticketId:$('linkTicketId').value.trim(),
      email:$('linkEmail').value.trim(),turnstileToken:captcha});
    flash(t('sentLink'),'success');
  }catch(error){flash(safeError(error),'error');}
  finally{resetChallenge(captchaLink);busy=false;$('linkSubmit').disabled=false;}
});
$('createForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!serviceEnabled||busy)return;
  const captcha=accountToken?null:challengeToken(captchaCreate);
  if(!accountToken&&!captcha){flash(t('error'),'error');return;}
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
  finally{resetChallenge(captchaCreate);busy=false;$('createSubmit').disabled=false;}
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
  if(!currentTicket||!confirm(t('confirmClose'))||busy)return;
  busy=true;
  try{await support('close',{ticketId:currentTicket.id},token());await openTicket(currentTicket.id);flash(t('closed'),'success');}
  catch(e){flash(safeError(e),'error');}finally{busy=false;}
});
$('reopenTicket').addEventListener('click',async()=>{
  if(!currentTicket||busy)return;
  busy=true;
  try{await support('reopen',{ticketId:currentTicket.id},token());await openTicket(currentTicket.id);flash(t('reopened'),'success');}
  catch(e){flash(safeError(e),'error');}finally{busy=false;}
});
$('newTicket').addEventListener('click',()=>{currentTicket=null;selectedId=null;$('chatPane').hidden=true;$('newTicketPane').hidden=false;$('ticketState').textContent=t('newTicket');flash('');});
$('refresh').addEventListener('click',refresh);
$('logout').addEventListener('click',()=>{signedOut();flash('');});
window.addEventListener('pagehide',()=>{accountToken=null;ticketToken=null;});
translate();setReady(false);verifyStatus().then(redeemFragment);
})();
