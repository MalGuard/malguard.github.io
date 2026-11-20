// Browser-only attachment preparation. Raw files never leave this page.
// The user reviews a new candidate BEFORE upload; AI consent is separate.
import {redactLog,validateLogText,supportPrivacyLimits} from './support-privacy.mjs';
const $=id=>document.getElementById(id);
const MAX_CHUNK=512*1024;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function typeOf(file){
 const ext=(file?.name||'').toLowerCase().split('.').pop();
 if(['png','jpg','jpeg','webp'].includes(ext))return 'image';
 if(['txt','log','json'].includes(ext))return 'log';
 return null;
}
function binary64(bytes){
 let str='';
 for(let i=0;i<bytes.length;i+=16384)
  str+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(str);
}
async function digest(bytes){
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function textNode(tag,text,className){
 const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;
}
export function initSupportAttachments({request,getTicket,getToken,getLanguage=()=> 'fa',onError=()=>{}}) {
 const section=$('attachmentSection'),picker=$('attachmentPick'),review=$('attachmentReviewed');
 const upload=$('attachmentUpload'),preview=$('attachmentPreview'),canvas=$('attachmentCanvas');
 const log=$('attachmentLogPreview'),detail=$('attachmentDetails'),notice=$('attachmentNotice');
 const list=$('uploadedList');
 let selected=null,previewTicket=null,sourceName=null,paintFrom=null;
 const fa=()=>getLanguage()==='fa';
 const message=(persian,english)=>fa()?persian:english;
 const announce=(s)=>{notice.textContent=s;};
 const setInactive=()=>{
   selected=null;paintFrom=null;review.checked=false;upload.disabled=true;preview.hidden=true;
   canvas.hidden=true;log.hidden=true;canvas.width=0;canvas.height=0;
 };
 function rect(e){
   const box=canvas.getBoundingClientRect();
   return {x:Math.max(0,Math.min(canvas.width,(e.clientX-box.left)*(canvas.width/box.width))),
     y:Math.max(0,Math.min(canvas.height,(e.clientY-box.top)*(canvas.height/box.height)))};
 }
 canvas.addEventListener('pointerdown',e=>{
   if(!selected||selected.kind!=='image')return;
   e.preventDefault();paintFrom=rect(e);canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointerup',e=>{
   if(!paintFrom||!selected||selected.kind!=='image')return;
   e.preventDefault();const end=rect(e);
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='#000';ctx.fillRect(Math.min(paintFrom.x,end.x),Math.min(paintFrom.y,end.y),
     Math.abs(end.x-paintFrom.x),Math.abs(end.y-paintFrom.y));
   paintFrom=null;review.checked=false;upload.disabled=true;
   announce(message('مستطیل سیاه به تصویر اضافه شد؛ دوباره نسخه نهایی رو بررسی کن.','A black box was added; review the updated image before confirming.'));
 });
 review.addEventListener('change',()=>{
   upload.disabled=!review.checked||!selected||getTicket()?.status==='closed';
 });
 picker.addEventListener('change',async()=>{
   setInactive();announce('');
   const file=picker.files?.[0];if(!file)return;
   const kind=typeOf(file);
   if(!kind){announce(message('فقط تصویر یا لاگ متنی مجازه.','Only image or text logs are allowed.'));return;}
   if(file.size<1||file.size>(kind==='image'?supportPrivacyLimits.imageBytes:supportPrivacyLimits.logBytes)){
     announce(message('حجم فایل از حد مجاز بیشتره.','File exceeds the allowed size.'));return;
   }
   const ticket=getTicket();
   if(!ticket||ticket.status==='closed'){announce(message('تیکت باید باز باشه.','Ticket must be open.'));return;}
   previewTicket=ticket.id;
   try{
     if(kind==='log'){
       const raw=await file.text();
       if(!validateLogText(raw))throw Error('invalid_log');
       const redacted=redactLog(raw);
       log.value=redacted.redacted;log.hidden=false;
       detail.textContent=message('پاک‌سازی اولیه انجام شد. موارد حساس احتمالی باقی‌مانده رو خودت حذف کن؛ نتیجه خودکار تضمینی نیست.','Initial patterns are masked. Manually remove remaining private details; automated detection is incomplete.');
       selected={kind};sourceName=file.name;
     } else {
       const image=await createImageBitmap(file);
       if(image.width*image.height>16000000||image.width<1||image.height<1){
         image.close();throw Error('invalid_dimensions');
       }
       canvas.width=image.width;canvas.height=image.height;
       const ctx=canvas.getContext('2d',{alpha:false});
       ctx.fillStyle='#fff';ctx.fillRect(0,0,image.width,image.height);
       ctx.drawImage(image,0,0);image.close();
       canvas.hidden=false;
       selected={kind};sourceName=file.name.replace(/\.[^.]+$/,'.png');
       detail.textContent=message('روی نواحی خصوصی با ماوس یا لمس، مستطیل سیاه بکش. خودکارسازی تشخیص متن تصویر هنوز تأیید نشده.','Drag black boxes over private areas. Automatic image text detection is not verified.');
     }
     review.checked=false;upload.disabled=true;preview.hidden=false;
   }catch(error){setInactive();announce(message('آماده‌سازی پیش‌نمایش ناموفق بود.','Could not prepare a privacy preview.'));}
 });
 async function candidate(){
   if(!selected)throw Error('no_preview');
   if(selected.kind==='log'){
     if(!validateLogText(log.value))throw Error('invalid_log');
     const contents=new TextEncoder().encode(log.value);
     if(contents.length>supportPrivacyLimits.logBytes||redactLog(log.value).redacted!==log.value)
       throw Error('not_redacted');
     return {bytes:contents,kind:'log',contentType:'text/plain',
       name:(sourceName||'error.log').replace(/[\/\\\x00-\x1f]/g,'_').slice(0,120)};
   }
   const blob=await new Promise((resolve,reject)=>
     canvas.toBlob(b=>b?resolve(b):reject(Error('image_processing_failed')),'image/png'));
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(bytes.length>supportPrivacyLimits.imageBytes||!bytes.length)throw Error('image_size');
   const name=(sourceName||'screenshot.png').replace(/[\/\\\x00-\x1f]/g,'_').slice(0,116)+
     (sourceName?.endsWith('.png')?'':'.png');
   return {bytes,kind:'image',contentType:'image/png',name};
 }
 upload.addEventListener('click',async()=>{
   const ticket=getTicket();
   if(!review.checked||!selected||!ticket||ticket.status==='closed'||ticket.id!==previewTicket)return;
   upload.disabled=true;picker.disabled=true;review.disabled=true;
   try{
     const c=await candidate(),sha=await digest(c.bytes);
     const partCount=Math.ceil(c.bytes.length/MAX_CHUNK);
     announce(message('در حال بارگذاری امن بخش‌های فایل…','Uploading reviewed file in private chunks…'));
     const result=await request('attachment-start',{ticketId:ticket.id,
       kind:c.kind,name:c.name,bytes:c.bytes.length,partCount,contentType:c.contentType,
       sha256:sha,reviewed:true},getToken());
     if(!UUID.test(result.attachmentId))throw Error('bad_response');
     for(let index=0;index<partCount;index++){
       const block=c.bytes.slice(index*MAX_CHUNK,(index+1)*MAX_CHUNK);
       await request('attachment-chunk',{ticketId:ticket.id,attachmentId:result.attachmentId,
          index,data:binary64(block)},getToken());
       announce(message('بخش '+(index+1)+' از '+partCount+' ارسال شد.','Chunk '+(index+1)+' of '+partCount+' uploaded.'));
     }
     const done=await request('attachment-finish',{ticketId:ticket.id,attachmentId:result.attachmentId},getToken());
     if(done.state!=='ready'||done.sha256!==sha||done.modelAccess!==false)throw Error('unconfirmed_upload');
     announce(message('فایل در فضای خصوصی ذخیره شد. AI هنوز مجوز تحلیل نداره.','File stored privately. AI still has no access.'));
     setInactive();picker.value='';await refresh();
   }catch(error){
     announce(message('ارسال یا اعتبارسنجی کامل نشد. نسخه روی دستگاه باقی می‌مونه.','Upload or validation was not confirmed. The local preview remains available.'));
     onError(error);
   }finally{picker.disabled=false;review.disabled=false;upload.disabled=!review.checked;}
 });
 async function consent(file,approved) {
   const ticket=getTicket();if(!ticket||ticket.status==='closed')return;
   if(approved&&!confirm(message('نسخه پاک‌سازی‌شده این فایل برای Support Agent ارسال و تحلیل بشه؟','Allow Support Agent to analyze this exact redacted file?')))return;
   try{
     await request(approved?'attachment-approve':'attachment-revoke',
       {ticketId:ticket.id,attachmentId:file.id,...(approved?{sha256:file.redactedSha256,agree:true}:{})},
       getToken());
     await refresh();announce(approved?message('مجوز تحلیل صادر شد.','Analysis permission granted.'):message('مجوز تحلیل لغو شد.','Analysis permission revoked.'));
   }catch(error){onError(error);}
 }
 async function refresh(){
   const ticket=getTicket();if(!ticket||!UUID.test(ticket.id))return;
   list.replaceChildren();
   try{
     const answer=await request('attachment-list',{ticketId:ticket.id},getToken());
     for(const file of answer.attachments||[]){
       const card=textNode('div','','uploaded-file');
       const name=textNode('strong',file.name||'Attachment');
       const state=textNode('span',(file.state||'pending')+' · '+(file.bytes||0)+' bytes');
       card.append(name,state);
       if(file.state==='ready'){
         const button=textNode('button',file.aiApproved?message('لغو دسترسی AI','Revoke AI access'):message('اجازه تحلیل AI','Allow AI analysis'));
         button.type='button';button.className='secondary';button.disabled=ticket.status==='closed'&& !file.aiApproved;
         button.addEventListener('click',()=>consent(file,!file.aiApproved));card.append(button);
       }
       list.append(card);
     }
   }catch(error){onError(error);}
 }
 function show(){
   const ticket=getTicket();
   section.hidden=!ticket||ticket.status==='closed';
   if(!ticket)return;
   if(ticket.id!==previewTicket)setInactive();
   refresh();
 }
 return {show,refresh,hide:()=>{section.hidden=true;setInactive();}};
}
