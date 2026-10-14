(() => {
 'use strict';const form=document.getElementById('securityReportForm');if(!form)return;
 const endpoint='https://malware-ai-gray.vercel.app/api/report',message=document.getElementById('reportMessage'),result=document.getElementById('reportResult'),button=document.getElementById('reportSubmit'),count=document.getElementById('reportCount');
 const fa=()=>document.documentElement.lang==='fa',text=(en,per)=>fa()?per:en;let pending=null,worker=null,busy=false;
 const requestedKind=new URLSearchParams(location.search).get('kind');if(['security','bug','false-positive','feedback'].includes(requestedKind))document.getElementById('reportKind').value=requestedKind;
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
  busy=true;button.disabled=true;document.body.classList.add('is-sending');button.textContent=text('Sending your report…','در حال ارسال گزارش…');notice(text('Establishing a secure connection…','در حال برقراری ارتباط امن…'));
  try{
   const signature=JSON.stringify(payload);
   if(!pending||pending.signature!==signature||Date.now()>pending.expires){
    const challengeResponse=await fetch(endpoint,{method:'GET',mode:'cors',cache:'no-store',signal:AbortSignal.timeout(12000)});let challenge={};try{challenge=await challengeResponse.json()}catch{}
    if(!challengeResponse.ok||!challenge.challenge)throw Error(challengeResponse.status===429?'RATE_LIMITED':'UNAVAILABLE');
    const nonce=await proof(challenge,payload);pending={signature,expires:Date.now()+240000,body:{...payload,website:document.getElementById('reportWebsite').value,challenge:challenge.challenge,nonce}};
   }
   notice(text('Transmitting your message…','در حال ارسال پیام شما…'));
   const response=await fetch(endpoint,{method:'POST',mode:'cors',cache:'no-store',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify(pending.body)});let data={};try{data=await response.json()}catch{}
   if(!response.ok||data.ok!==true||data.status!=='accepted')throw Error(response.status===429?'RATE_LIMITED':data.code||'UNCONFIRMED');
   notice(text(`Your report was accepted by the email service for malguard.security@gmail.com. Thank you.\nReference: ${data.reference}`,`گزارش شما برای ارسال به malguard.security@gmail.com توسط سرویس ایمیل پذیرفته شد. سپاس.\nکد پیگیری: ${data.reference}`),false,true);
   form.reset();updateCount();pending=null;document.body.classList.add('report-sent');
  }catch(error){
   const rate=error.message==='RATE_LIMITED',expired=error.message==='PROOF_REQUIRED';if(expired)pending=null;
   notice(rate?text('Please wait a few minutes before sending another report. Your text is preserved.','لطفاً چند دقیقه پیش از ارسال دوباره صبر کنید. متن شما حفظ شده است.'):text('Sending could not be confirmed. Your text is preserved. Please retry.','ارسال تأیید نشد. متن شما حفظ شده است؛ لطفاً دوباره تلاش کنید.'),true);
  }finally{busy=false;button.disabled=false;document.body.classList.remove('is-sending');button.textContent=text('Send report','ارسال گزارش');}
 });
 message.addEventListener('input',()=>message.setCustomValidity(''));
 window.addEventListener('pagehide',()=>{worker?.terminate();worker=null;});
})();
