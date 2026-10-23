import {fetchPublic} from '../../game-scam-guard/server/network.js';
// Contract discovered from the owner's existing Worker health/API, not a new
// account or copied private implementation. Credentials come only from runtime.
const models={fast:'@cf/meta/llama-3.2-3b-instruct',strong:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',fallback:'@cf/meta/llama-3.1-8b-instruct-fp8'};
export function createWorkersModel({env=process.env,transport=fetchPublic}={}){
  const status=()=>{
    const ready=!!env.MALGUARD_WORKER_PROXY_TOKEN&&Object.hasOwn(models,env.MALGUARD_AI_WORKERS_MODE||'')&&env.MALGUARD_AI_WORKERS_FREE_CONFIRMED==='true'&&env.MALGUARD_AI_WORKERS_REVIEWED==='true';
    return {state:ready?'configured':'disabled',provider:ready?'workers_ai':null,model:ready?models[env.MALGUARD_AI_WORKERS_MODE]:null,reason:ready?'live_not_verified':'worker_access_quota_or_review_pending',mode:'deterministic_tool_routing',liveVerified:false};
  };
  return {status,async respond(message,locale){
    if(status().state==='disabled')return null;
    const mode=env.MALGUARD_AI_WORKERS_MODE;
    const body=JSON.stringify({model:mode,webSearch:false,messages:[{role:'user',content:`Reply in ${locale==='fa'?'Persian':'English'}. General assistance only. You have not scanned any file, URL or hash. Never give security verdicts or claim tool use; direct security checks to the MalGuard tools. User message follows:\n${message}`} ]});
    const response=await transport('https://malware-ai.malguard-security.workers.dev/api/chat',{method:'POST',noRedirect:true,limit:128*1024,timeout:15000,totalTimeout:18000,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Origin':'https://malguard.github.io','X-MalGuard-Proxy':env.MALGUARD_WORKER_PROXY_TOKEN},body});
    if(response.status!==200)throw new Error('worker_http');
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
