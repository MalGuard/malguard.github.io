// Cloudflare Workers AI browser client. No model calls are sent to Vercel.
// This module never contains provider secrets. Browser supplies Origin automatically.
const ROOT="https://malware-ai.malguard-security.workers.dev";
export const CF_DEFAULTS=Object.freeze({chat:"chat_granite",work:"work_qwen",code:"code_ultra"});
// The client keeps the complete known catalog visible even if an older Worker
// responds with only six models or the catalog cannot be fetched. Unverified
// entries are NEVER enabled until the server explicitly advertises them.
const CATALOG=Object.freeze([
 ['chat_granite','chat','Granite 4 Micro · Fast','workers_ai'],
 ['chat_flash','chat','Gemini 3.1 Flash-Lite','gemini'],
 ['work_qwen','work','Qwen3 30B · Work','workers_ai'],
 ['work_gemma','work','Gemma 4 31B · Work','gemini'],
 ['code_super','code','Nemotron 3 Super 120B','workers_ai'],
 ['code_ultra','code','Nemotron 3 Ultra 550B · Free','openrouter'],
 ['llama70b','work','Llama 3.3 70B · Legacy','workers_ai'],
 ['llama8b','chat','Llama 3.1 8B · Legacy','workers_ai'],
 ['cf_gptoss120','code','GPT-OSS 120B · Cloudflare','workers_ai'],
 ['cf_gptoss20','work','GPT-OSS 20B · Cloudflare','workers_ai'],
 ['cf_qwen3','work','Qwen3 30B · Classic','workers_ai'],
 ['cf_granite','chat','Granite 4 Micro · Classic','workers_ai'],
 ['cf_llama3b','chat','Llama 3.2 3B · Fast','workers_ai'],
 ['cf_qwen_coder','code','Qwen2.5 Coder 32B · Classic','workers_ai'],
 ['cf_scout','work','Llama 4 Scout · Classic','workers_ai'],
 ['cf_mistral','work','Mistral Small 3.1 24B','workers_ai'],
 ['cf_nemotron','code','Nemotron 3 Super · Classic','workers_ai'],
 ['cf_glm','chat','GLM 4.7 Flash · Classic','workers_ai'],
 ['cf_gemma4','work','Gemma 4 26B · Cloudflare','workers_ai'],
 ['gemini_flash','chat','Gemini Flash · Classic','gemini'],
 ['groq_qwen','work','Qwen 3.8 27B · Groq','groq'],
 ['groq_gptoss','code','GPT-OSS 120B · Groq','groq']
]);
const IDS=new Set(CATALOG.map(([id])=>id));
export function unavailableCFModels(){
 return CATALOG.map(([id,mode,label,provider])=>({id,mode,label,provider,available:false}));
}
export async function fetchCFModels({fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(ROOT+"/api/public-models",{method:"GET",credentials:"omit",cache:"no-store",mode:"cors",signal});
 if(!response.ok)throw new Error("cloudflare_unavailable");
 const data=await response.json();
 if(!Array.isArray(data.models)||data.models.length>500)throw new Error("invalid_model_catalog");
 const seen=new Map();
 for(const m of data.models){
  if(m&&IDS.has(m.id)&&!seen.has(m.id)&&["chat","work","code"].includes(m.mode)&&typeof m.available==="boolean"&&typeof m.label==="string")seen.set(m.id,m);
 }
 const models=CATALOG.map(([id,mode,label,provider])=>{
  const server=seen.get(id),consistent=server&&server.mode===mode&&server.provider===provider;
  return {id,mode,label:consistent?server.label:label,provider,available:!!(consistent&&server.available)};
 });
 Object.defineProperty(models,"accountQuotaEnabled",{value:data.accountQuota?.enabled===true,enumerable:false});
 return models;
}
export async function callCFModel({mode,model,message,history=[],sessionToken,quotaEnabled=false,freeFallback=false,signal,fetchImpl=fetch}){
 if(!["chat","work","code"].includes(mode)||!IDS.has(model)||typeof message!=="string"||!message.trim()||message.length>5000||quotaEnabled&&(typeof sessionToken!=="string"||!sessionToken))throw new Error("invalid_model_request");
 const body={mode,model,message,history:history.slice(-6).map(m=>({role:m.role,content:m.content})),freeFallback:freeFallback===true};
 const response=await fetchImpl(ROOT+"/api/public-model-chat",{method:"POST",credentials:"omit",cache:"no-store",mode:"cors",signal,headers:{"Content-Type":"application/json",...(quotaEnabled?{Authorization:"Bearer "+sessionToken}:{})},body:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{throw new Error("cloudflare_invalid_response");}
 if(!response.ok)throw Object.assign(new Error(data?.error||"cloudflare_unavailable"),{code:data?.error||"cloudflare_unavailable",status:response.status,retryAfterSeconds:data?.retryAfterSeconds});
 if(typeof data.text!=="string"||!data.text.trim()||typeof data.model!=="string"||typeof data.provider!=="string")throw new Error("cloudflare_invalid_response");
 return {text:data.text,model:data.model,selectedModel:data.modelId,provider:data.provider,fallbackUsed:!!data.fallback,securityAnalysis:false,...(data.usage&&typeof data.usage.remainingTokens==="number"?{usage:data.usage}:{})};
}

export async function fetchCFUsage({sessionToken,signal,fetchImpl=fetch}={}){
 if(typeof sessionToken!=="string"||!sessionToken)throw new Error("sign_in_required");
 const response=await fetchImpl(ROOT+"/api/account-usage",{method:"GET",credentials:"omit",cache:"no-store",mode:"cors",signal,headers:{Authorization:"Bearer "+sessionToken}});
 if(!response.ok)throw new Error(response.status===401?"sign_in_required":"quota_unavailable");
 const data=await response.json();
 if(!Number.isSafeInteger(data.limitTokens)||!Number.isSafeInteger(data.remainingTokens)||!Number.isSafeInteger(data.usedTokens)||data.limitTokens<0||data.remainingTokens<0||data.remainingTokens>data.limitTokens||typeof data.resetAt!=="string")throw new Error("invalid_usage");
 return {limitTokens:data.limitTokens,remainingTokens:data.remainingTokens,usedTokens:data.usedTokens,resetAt:data.resetAt,estimated:true};
}
