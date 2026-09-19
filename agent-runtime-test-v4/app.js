const API="https://malware-d4xnnwc2u-mcazarderakhsh-4187.vercel.app/api/chat";
const input=document.getElementById("prompt"),send=document.getElementById("send"),out=document.getElementById("output");
const messages=[];
async function chat(){
 const value=input.value.trim(); if(!value)return;
 send.disabled=true; out.textContent="Thinking...";
 messages.push({role:"user",text:value});
 try{
  const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
  let d={}; try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.error||("Backend HTTP "+r.status));
  messages.push({role:"assistant",text:d.text||""});
  out.textContent=d.text||"(empty response)"; input.value="";
 }catch(e){out.textContent="Error: "+e.message}
 finally{send.disabled=false}
}
send.addEventListener("click",chat);
input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();chat()}});
