(() => {
 'use strict';const form=document.getElementById('securityReportForm');if(!form)return;
 const endpoint='https://malware-ai-gray.vercel.app/api/report',message=document.getElementById('reportMessage'),result=document.getElementById('reportResult'),button=document.getElementById('reportSubmit'),count=document.getElementById('reportCount');
 const fa=()=>document.documentElement.lang==='fa',text=(en,per)=>fa()?per:en;let pending=null,worker=null,busy=false,aiController=null;
 const aiConsent=document.getElementById('reportAiConsent'),aiPanel=document.getElementById('reportAiPanel'),aiReply=document.getElementById('reportAiReply'),kindSelect=document.getElementById('reportKind');
 const updateAi=()=>{const bug=kindSelect.value==='bug';aiConsent.disabled=!bug;if(!bug)aiConsent.checked=false;};kindSelect.addEventListener('change',updateAi);
 const motion=state=>window.dispatchEvent(new CustomEvent('mg:secure-state',{detail:{state}}));
 const requestedKind=new URLSearchParams(location.search).get('kind');if(['security','bug','false-positive','feedback'].includes(requestedKind))document.getElementById('reportKind').value=requestedKind;
 updateAi();
 const updateCount=()=>{count.textContent=message.value.length.toLocaleString(fa()?'fa':'en')+' / '+(6000).toLocaleString(fa()?'fa':'en');};message.addEventListener('input',updateCount);window.addEventListener('malguard-language',updateCount);updateCount();button.disabled=false;
 function notice(value,error=false,success=false){result.textContent=value;result.classList.toggle('error',error);result.classList.toggle('success',success);}
 async function proof(challenge,payload){
  return new Promise((resolve,reject)=>{
   worker=new Worker('/assets/report-proof.worker.js?v=20261013-secure-forms');
   const timer=setTimeout(()=>{worker?.terminate();worker=null;reject(Error('VERIFICATION_TIMEOUT'));},30000);
   worker.onmessage=e=>{clearTimeout(timer);worker.terminate();worker=null;e.data.nonce?resolve(e.data.nonce):reject(Error('VERIFICATION_FAILED'));};
   worker.onerror=()=>{clearTimeout(timer);worker?.terminate();worker=null;reject(Error('VERIFICATION_FAILED'));};worker.postMessage({...challenge,payload});
  });
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  const payload={kind:document.getElementById('reportKind').value,message:message.value.trim(),name:document.getElementById('reportName').value.trim(),email:document.getElementById('reportEmail').value.trim()};
  if(!payload.message){message.setCustomValidity(text('Write a message before sending.','پیش از ارسال، پیام خود را بنویسید.'));message.reportValidity();return;}
  const wantsAi=aiConsent.checked&&payload.kind==='bug';aiPanel.hidden=true;aiReply.textContent='';
  busy=true;button.disabled=true;document.body.classList.add('is-sending');document.body.classList.remove('report-sent');motion('checking');button.textContent=text('Sending your report…','در حال ارسال گزارش…');notice(text('Establishing a secure connection…','در حال برقراری ارتباط امن…'));
  try{
   const signature=JSON.stringify(payload);
   if(!pending||pending.signature!==signature||Date.now()>pending.expires){
    const challengeResponse=await fetch(endpoint,{method:'GET',mode:'cors',cache:'no-store',signal:AbortSignal.timeout(12000)});let challenge={};try{challenge=await challengeResponse.json()}catch{}
    if(!challengeResponse.ok||!challenge.challenge)throw Error(challengeResponse.status===429?'RATE_LIMITED':'UNAVAILABLE');
    const nonce=await proof(challenge,payload);pending={signature,expires:Date.now()+240000,body:{...payload,website:document.getElementById('reportWebsite').value,challenge:challenge.challenge,nonce}};
   }
   notice(text('Transmitting your message…','در حال ارسال پیام شما…'));
   motion('sending');
   const response=await fetch(endpoint,{method:'POST',mode:'cors',cache:'no-store',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify(pending.body)});let data={};try{data=await response.json()}catch{}
   if(!response.ok||data.ok!==true||data.status!=='accepted')throw Error(response.status===429?'RATE_LIMITED':data.code||'UNCONFIRMED');
   notice(text(`Your report was accepted by the email service for malguard.security@gmail.com. Thank you.\nReference: ${data.reference}`,`گزارش شما برای ارسال به malguard.security@gmail.com توسط سرویس ایمیل پذیرفته شد. سپاس.\nکد پیگیری: ${data.reference}`),false,true);
   form.reset();document.getElementById('reportKind').value=payload.kind;updateCount();pending=null;document.body.classList.add('report-sent');motion('success');
   updateAi();
   if(wantsAi){
    aiPanel.hidden=false;aiReply.textContent=text('Your report is accepted. Preparing optional AI guidance…','گزارش پذیرفته شد؛ در حال دریافت راهنمایی اختیاری AI…');
    aiController=new AbortController();
    try{const {replyToBugReport}=await import('/assets/report-ai.mjs?v=20261027');const guidance=await replyToBugReport({accepted:true,consent:true,kind:payload.kind,message:payload.message,locale:fa()?'fa':'en',signal:aiController.signal});aiReply.textContent=guidance.status==='replied'?guidance.text:text('AI guidance is unavailable. Your email-service acceptance above is unchanged. Do not resend just for an AI reply.','راهنمایی AI در دسترس نیست؛ پذیرش گزارش توسط سرویس ایمیل تغییری نکرده است. فقط برای پاسخ AI گزارش را دوباره نفرست.');}
    catch{aiReply.textContent=text('AI guidance is unavailable. Your report was already accepted by the email service.','راهنمایی AI در دسترس نیست؛ سرویس ایمیل قبلاً گزارش را پذیرفته است.');}finally{aiController=null;}
   }
  }catch(error){
   const rate=error.message==='RATE_LIMITED',expired=error.message==='PROOF_REQUIRED';if(expired)pending=null;
   notice(rate?text('Please wait a few minutes before sending another report. Your text is preserved.','لطفاً چند دقیقه پیش از ارسال دوباره صبر کنید. متن شما حفظ شده است.'):text('Sending could not be confirmed. Your text is preserved. Please retry.','ارسال تأیید نشد. متن شما حفظ شده است؛ لطفاً دوباره تلاش کنید.'),true);
   motion('error');
  }finally{busy=false;button.disabled=false;document.body.classList.remove('is-sending');button.textContent=text('Send report','ارسال گزارش');}
 });
 message.addEventListener('input',()=>message.setCustomValidity(''));
 window.addEventListener('pagehide',()=>{worker?.terminate();worker=null;aiController?.abort();});
})();
