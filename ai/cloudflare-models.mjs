// Cloudflare Workers AI browser client. No model calls are sent to Vercel.
// This module never contains provider secrets. Browser supplies Origin automatically.
const ROOT="https://malware-ai.malguard-security.workers.dev";
export const CF_DEFAULTS=Object.freeze({chat:"chat_granite",work:"work_qwen",code:"code_ultra"});
const IDS=new Set(["chat_granite","chat_flash","work_qwen","work_gemma","code_super","code_ultra","llama70b","llama8b","cf_gptoss120","cf_gptoss20","cf_qwen3","cf_granite","cf_llama3b","cf_qwen_coder","cf_scout","cf_mistral","cf_nemotron","cf_glm","cf_gemma4","gemini_flash","groq_qwen","groq_gptoss"]);
export async function fetchCFModels({fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(ROOT+"/api/public-models",{method:"GET",credentials:"omit",cache:"no-store",mode:"cors",signal});
 if(!response.ok)throw new Error("cloudflare_unavailable");
 const data=await response.json();
 if(!Array.isArray(data.models))throw new Error("invalid_model_catalog");
 const models=data.models.filter(m=>m&&IDS.has(m.id)&&["chat","work","code"].includes(m.mode)&&typeof m.label==="string"&&typeof m.available==="boolean").map(m=>({id:m.id,mode:m.mode,label:m.label,provider:m.provider,available:m.available}));
 Object.defineProperty(models,"accountQuotaEnabled",{value:data.accountQuota?.enabled===true,enumerable:false});
 return models;
}
export async function callCFModel({mode,model,message,history=[],sessionToken,quotaEnabled=false,freeFallback=false,signal,fetchImpl=fetch}){
 if(!["chat","work","code"].includes(mode)||!IDS.has(model)||typeof message!=="string"||!message.trim()||message.length>5000||quotaEnabled&&(typeof sessionToken!=="string"||!sessionToken))throw new Error("invalid_model_request");
 if(typeof freeFallback!=="boolean")throw new Error("invalid_model_request");
 const body={mode,model,message,history:history.slice(-6).map(m=>({role:m.role,content:m.content})),...(freeFallback?{freeFallback:true}:{})};
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
