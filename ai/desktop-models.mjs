import {PRODUCT_IDENTITY_POLICY} from './identity.mjs';

export const desktopModels=Object.fromEntries([
 ['native_qwen8','Qwen3 8B','qwen3:8b',5.2],
 ['native_qwen32','Qwen3 32B','qwen3:32b',20],
 ['native_gpt20','GPT-OSS 20B','gpt-oss:20b',14],
 ['native_gpt120','GPT-OSS 120B','gpt-oss:120b',65],
 ['native_qwen235','Qwen3 235B','qwen3:235b',142],
 ['native_deepseek671','DeepSeek R1 671B','deepseek-r1:671b',404]
].map(([id,label,model,downloadGB])=>[id,Object.freeze({id,label,model,downloadGB,command:`ollama pull ${model}`,source:`https://ollama.com/library/${model}`,hardwareNote:'Approximate model-file download size, not a RAM requirement. Allow additional free RAM/VRAM for the runtime and context. Large models may require workstation or server hardware; performance depends on available memory and GPU support.'})]));
Object.freeze(desktopModels);
const BASE='http://127.0.0.1:11434',MAX_BYTES=1024*1024;
const fail=code=>new Error(code);
async function readJSON(response,signal){
 if(!response.ok)throw fail('desktop_unavailable');
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw fail('desktop_response_too_large');
 const reader=response.body?.getReader();if(!reader)throw fail('desktop_invalid_response');
 let total=0;const chunks=[];
 try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES)throw fail('desktop_response_too_large');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('desktop_invalid_response');}
}
export function createDesktopChat({fetchImpl=globalThis.fetch,connectTimeout=5000,responseTimeout=120000}={}){
 let available=false,installedIDs=[],active;
 const snapshot=()=>({available,installedIDs:[...installedIDs],models:installedIDs.map(id=>desktopModels[id])});
 async function request(path,options,signal,timeout){
  if(active)throw fail('desktop_busy');
  const controller=new AbortController();active=controller;
  const abort=()=>controller.abort(signal.reason);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Desktop request timed out','TimeoutError')),timeout);
  try{controller.signal.throwIfAborted();const response=await fetchImpl(BASE+path,{...options,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});return await readJSON(response,controller.signal);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(active===controller)active=undefined;}
 }
 return {
  get availability(){return snapshot();},
  // A real, explicit user-initiated pull from an already running *local* Ollama.
  // Never download model weights through MalGuard's servers or silently install software.
  async download({model,signal,onProgress=()=>{}}={}){
   if(!Object.hasOwn(desktopModels,model))throw fail('invalid_desktop_model');
   if(!available)throw fail('desktop_unavailable');
   if(active)throw fail('desktop_busy');
   const controller=new AbortController();active=controller;
   const abort=()=>controller.abort(signal?.reason||new DOMException('Stopped by user','AbortError'));
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   let finished=false,reader;
   try{
    controller.signal.throwIfAborted();
    const selected=desktopModels[model];
    const response=await fetchImpl(BASE+'/api/pull',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selected.model,stream:true}),signal:controller.signal});
    if(!response.ok)throw fail('desktop_download_failed');
    reader=response.body?.getReader();if(!reader)throw fail('desktop_download_invalid_response');
    const decoder=new TextDecoder('utf-8',{fatal:true});let buffered='',received=0;
    const record=line=>{
     if(line.length>8192)throw fail('desktop_download_invalid_response');
     let event;try{event=JSON.parse(line);}catch{throw fail('desktop_download_invalid_response');}
     if(!event||typeof event.status!=='string')throw fail('desktop_download_invalid_response');
     if(event.error)throw fail('desktop_download_failed');
     const status=event.status.slice(0,90);
     const total=Number(event.total),completed=Number(event.completed);
     const hasProgress=Number.isFinite(total)&&total>0&&Number.isFinite(completed)&&completed>=0&&completed<=total;
     onProgress({status,progress:hasProgress?Math.min(99,Math.floor(completed/total*100)):null,completed:hasProgress?completed:null,total:hasProgress?total:null,finished:status==='success'});
     if(status==='success')finished=true;
    };
    while(true){
     controller.signal.throwIfAborted();
     const {done,value}=await reader.read();if(done)break;
     received+=value.byteLength;if(received>10*1024*1024)throw fail('desktop_download_invalid_response');
     buffered+=decoder.decode(value,{stream:true});
     if(buffered.length>16384&&!buffered.includes('\\n'))throw fail('desktop_download_invalid_response');
     let index;while((index=buffered.indexOf('\\n'))>=0){const line=buffered.slice(0,index).trim();buffered=buffered.slice(index+1);if(line)record(line);}
     if(buffered.length>16384)throw fail('desktop_download_invalid_response');
    }
    buffered+=decoder.decode();
    if(buffered.trim())record(buffered.trim());
    if(!finished)throw fail('desktop_download_incomplete');
   }finally{
    try{await reader?.cancel();}catch{}
    signal?.removeEventListener('abort',abort);
    if(active===controller)active=undefined;
   }
   // A completed stream is not enough; only the model reported by Ollama /api/tags is usable.
   const after=await this.connect({signal});
   if(!after.installedIDs.includes(model))throw fail('desktop_download_not_installed');
   return after;
  },
  stop(){active?.abort(new DOMException('Stopped by user','AbortError'));},
  async connect({signal}={}){
   if(active)throw fail('desktop_busy');available=false;installedIDs=[];
   const data=await request('/api/tags',{method:'GET'},signal,connectTimeout);
   if(!Array.isArray(data.models)||data.models.length>1000)throw fail('desktop_invalid_response');
   installedIDs=Object.values(desktopModels).filter(model=>data.models.some(row=>row&&row.name===model.model)).map(model=>model.id);
   available=true;return snapshot();
  },
  async respond({model,message,locale='en',history=[],signal}){
   if(!Object.hasOwn(desktopModels,model))throw fail('invalid_desktop_model');
   if(!available||!installedIDs.includes(model))throw fail('desktop_model_not_installed');
   if(typeof message!=='string'||!message.trim()||message.length>5000||!['en','fa'].includes(locale)||!Array.isArray(history)||history.length>8||history.some(row=>!row||!['user','assistant'].includes(row.role)||typeof row.content!=='string'||row.content.length>2000))throw fail('desktop_invalid_input');
   const policy=locale==='fa'?'فقط به فارسی روان و طبیعی پاسخ بده. نتیجهٔ بررسی امنیتی یا جست‌وجوی وب جعل نکن. اطلاعات محرمانه نخواه.':'Reply in concise natural English. Never invent security checks, scan results or web searches. Never request secrets.';
   const selected=desktopModels[model];
   const data=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selected.model,stream:false,think:false,keep_alive:'5m',messages:[{role:'system',content:policy+' '+PRODUCT_IDENTITY_POLICY},...history.map(({role,content})=>({role,content})),{role:'user',content:message}],options:{num_predict:2048,num_ctx:8192}})},signal,responseTimeout);
   if(data.model!==selected.model||data.done!==true||data.done_reason&&data.done_reason!=='stop'||data.message?.role!=='assistant'||typeof data.message.content!=='string'||!data.message.content.trim()||data.message.content.length>16000||/<\/?think>/i.test(data.message.content))throw fail('desktop_incomplete_response');
   return {text:data.message.content,model:selected.model,selectedModel:model,provider:'ollama',securityAnalysis:false};
  }
 };
}
