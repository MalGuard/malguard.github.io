// Owner-only support inbox. Sessions and OTPs are held in page memory only.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const publicHosts=new Set(['malguard.site','www.malguard.site','malguard.github.io']);
const base=publicHosts.has(location.hostname)?'https://api.malguard.site':'';
let accountToken=null,adminToken=null,challengeId=null,selected=null,busy=false,available=false;
function feedback(message,error=false){$('adminFlash').textContent=message;$('adminFlash').className='flash '+(error?'error':'success');}
function setUnavailable(text){$('adminNotice').textContent=text;$('adminNotice').className='notice bad';$('ownerForm').querySelector('button').disabled=true;}
async function api(path,body,auth){
 const response=await fetch(base+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',cache:'no-store',
  headers:body?{'content-type':'application/json',...(auth?{authorization:'Bearer '+auth}:{})}:{},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 const raw=await response.text();if(raw.length>65536)throw Error('invalid_response');
 let value;try{value=JSON.parse(raw);}catch{throw Error('invalid_response');}
 if(!response.ok)throw Error('request_unconfirmed');
 return value;
}
const support=(name,body,token)=>api('/api/support/'+name,body,token);
function disable(form,blocked){for(const field of form.elements)field.disabled=blocked;}
async function initialize(){
 try{
  const state=await support('status');
  available=state.enabled===true&&state.adminEnabled===true;
  if(available){disable($('ownerForm'),false);$('adminNotice').textContent='بخش پشتیبانی مالک آماده ورود است.';$('adminNotice').className='notice good';}
  else setUnavailable('ورود مدیریتی هنوز فعال نیست. هیچ دسترسی خصوصی صادر نمی‌شود.');
 }catch{setUnavailable('اتصال امن پنل تأیید نشد.');}
}
function signedOut(){
 accountToken=null;adminToken=null;challengeId=null;selected=null;busy=false;
 $('ownerEmail').value='';$('ownerPassword').value='';$('otpCode').value='';
 $('ownerLogin').hidden=false;$('ownerOtp').hidden=true;$('ownerList').hidden=true;
 $('adminChat').hidden=true;$('adminEmpty').hidden=false;
 $('adminTickets').replaceChildren();$('adminMessages').replaceChildren();
 feedback('');disable($('ownerForm'),!available);
}
$('ownerForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!available||busy)return;busy=true;disable($('ownerForm'),true);feedback('در حال اعتبارسنجی حساب…');
 try{
  const session=await api('/api/game-scam-guard/auth/password',{
    email:$('ownerEmail').value.trim(),password:$('ownerPassword').value
  });
  if(typeof session.sessionToken!=='string')throw Error('invalid_session');
  accountToken=session.sessionToken;$('ownerPassword').value='';
  const request=await support('admin-code-start',{},accountToken);
  if(typeof request.challengeId!=='string')throw Error('invalid_challenge');
  challengeId=request.challengeId;$('ownerLogin').hidden=true;$('ownerOtp').hidden=false;
  feedback('درخواست کد توسط سرویس پذیرفته شد. کد ایمیلی رو وارد کن.');
 }catch{accountToken=null;feedback('هویت مالک یا ارسال کد دومرحله‌ای تأیید نشد.',true);}
 finally{busy=false;disable($('ownerForm'),!available);}
});
$('otpForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!available||busy||!accountToken||!challengeId)return;
 busy=true;disable($('otpForm'),true);feedback('در حال بررسی کد…');
 try{
  const result=await support('admin-code-verify',{challengeId,code:$('otpCode').value.trim()},accountToken);
  if(typeof result.accessToken!=='string')throw Error('invalid_admin_session');
  adminToken=result.accessToken;$('otpCode').value='';challengeId=null;
  $('ownerOtp').hidden=true;$('ownerList').hidden=false;feedback('ورود دومرحله‌ای تأیید شد.','success');
  await refresh();
 }catch{feedback('کد معتبر نیست یا منقضی شده. برای کد جدید دوباره وارد شو.',true);}
 finally{busy=false;disable($('otpForm'),false);}
});
async function refresh(){
 if(!adminToken)return;
 try{
  const items=(await support('list',{},adminToken)).tickets||[];
  const list=$('adminTickets');list.replaceChildren();
  if(!items.length)list.append(document.createTextNode('تیکتی در صف نیست.'));
  for(const t of items){
   const b=document.createElement('button');b.type='button';b.className='ticket-choice';
   b.textContent=t.subject||t.id;
   const meta=document.createElement('small');meta.dir='ltr';
   meta.textContent=[t.kind,t.routing,t.status,t.id.slice(0,8)].join(' · ');
   b.append(meta);b.addEventListener('click',()=>openTicket(t.id));list.append(b);
  }
 }catch{feedback('خواندن فهرست تیکت‌ها تأیید نشد. ممکنه نشست منقضی شده باشه.',true);}
}
async function openTicket(id){
 if(!adminToken||!/^[0-9a-f-]{36}$/i.test(id))return;
 try{
  const response=await support('ticket',{ticketId:id},adminToken);
  selected=response.ticket;
  $('adminChat').hidden=false;$('adminEmpty').hidden=true;
  $('adminTicketTitle').textContent=selected.subject||'Ticket';
  $('adminTicketId').textContent=selected.id;
  $('adminTicketStatus').textContent=selected.status;
  $('adminMessages').replaceChildren();
  for(const m of response.messages||[]){
   const li=document.createElement('li');li.className='msg '+(m.author_kind==='reporter'?'reporter':'');
   const text=document.createElement('div');text.textContent=m.content;
   const by=document.createElement('small');by.textContent=(m.author_kind||'system')+' · '+(m.created_at||'');
   li.append(text,by);$('adminMessages').append(li);
  }
  $('adminReply').disabled=selected.status==='closed';
  $('adminReplyForm').hidden=selected.status==='closed';
  $('adminCloseForm').hidden=selected.status==='closed';
 }catch{feedback('بازکردن این تیکت مجاز یا قابل تأیید نیست.',true);}
}
$('adminReplyForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!adminToken||!selected||selected.status==='closed')return;busy=true;
 disable($('adminReplyForm'),true);
 try{
  await support('message',{ticketId:selected.id,message:$('adminReply').value.trim()},adminToken);
  $('adminReply').value='';await openTicket(selected.id);feedback('پاسخ کارشناس ذخیره شد.');
 }catch{feedback('ذخیره پاسخ تأیید نشد.',true);}
 finally{busy=false;disable($('adminReplyForm'),selected?.status==='closed');}
});
$('adminCloseForm').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!adminToken||!selected||selected.status==='closed')return;
 const reason=$('adminCloseReason').value.trim();
 if(!reason||!confirm('تیکت بسته بشه و شمارش حذف ۳۰روزه پیوست‌ها شروع بشه؟'))return;
 busy=true;disable($('adminCloseForm'),true);
 try{
  await support('close',{ticketId:selected.id,reason},adminToken);
  $('adminCloseReason').value='';await openTicket(selected.id);await refresh();
  feedback('تیکت بسته شد و دلیل ثبت شد.');
 }catch{feedback('بستن تیکت تأیید نشد.',true);}
 finally{busy=false;disable($('adminCloseForm'),selected?.status==='closed');}
});
$('ownerRefresh').addEventListener('click',refresh);
$('ownerLogout').addEventListener('click',signedOut);
window.addEventListener('pagehide',()=>{accountToken=null;adminToken=null;});
disable($('ownerForm'),true);initialize();
})();