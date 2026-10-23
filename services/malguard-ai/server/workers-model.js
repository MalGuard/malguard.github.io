import {httpFailure} from '../../../ai/service-errors.mjs';
import {fetchPublic} from '../../game-scam-guard/server/network.js';
// Contract discovered from the owner's existing Worker health/API, not a new
// account or copied private implementation. Credentials come only from runtime.
const models={fast:'@cf/meta/llama-3.2-3b-instruct',strong:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',fallback:'@cf/meta/llama-3.1-8b-instruct-fp8'};
export function createWorkersModel({env=process.env,transport=fetchPublic}={}){
  const selectedMode=env.MALGUARD_AI_WORKERS_MODE||'strong';
  const status=()=>{
    const ready=!!env.MALGUARD_WORKER_PROXY_TOKEN&&Object.hasOwn(models,selectedMode);
    return {state:ready?'configured':'disabled',provider:ready?'workers_ai':null,model:ready?models[selectedMode]:null,reason:ready?'live_not_verified':'missing_worker_credential',liveVerified:false};
  };
  return {status,async respond(message,locale,history=[],modelId){
    if(status().state==='disabled')return null;
    if(modelId&&!['llama70b','llama8b'].includes(modelId))throw new Error('model_not_configured');
    const mode=modelId==='llama70b'?'strong':modelId==='llama8b'?'fallback':selectedMode;
    const body=JSON.stringify({model:mode,webSearch:false,messages:[...history.slice(-8),{role:'user',content:`Reply naturally in ${locale==='fa'?'Persian':'English'}. Continue this conversation and help with ordinary or technical questions. File/URL security checks are performed separately by MalGuard tools. Do not invent scan results, web searches or safety guarantees. User message follows:\n${message}`} ]});
    const response=await transport('https://malware-ai.malguard-security.workers.dev/api/chat',{method:'POST',noRedirect:true,limit:128*1024,timeout:15000,totalTimeout:18000,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Origin':'https://malguard.github.io','X-MalGuard-Proxy':env.MALGUARD_WORKER_PROXY_TOKEN},body});
    if(response.status!==200){let details;try{details=JSON.parse(response.bytes.toString('utf8'));}catch{}throw httpFailure(response.status,response.headers,details);}
    let provider,model,value='';
    for(const event of response.bytes.toString('utf8').split(/\r?\n\r?\n/)){
      if(!event.trim())continue;
      const line=event.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
      if(!line)continue;
      const data=JSON.parse(line);
      if(data.error||data.fallback)throw new Error('worker_incomplete');
      if(data.provider!==undefined){if(provider||data.provider!==mode||typeof data.model!=='string')throw new Error('worker_provider_mismatch');provider=data.provider;model=data.model.slice(0,120);}
      if(typeof data.response==='string')value+=data.response;
    }
    if(!provider||!value.trim()||value.length>6000)throw new Error('worker_empty_or_incomplete');
    return {text:value,provider:'workers_ai',model,checkedAt:new Date().toISOString(),securityAnalysis:false};
  }};
}
