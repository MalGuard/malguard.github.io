// Vercel-only model client. Never exposes provider credentials to the browser.
import {modelsApiRoot,PRODUCTION_MODELS_ORIGIN} from './api-root.mjs';
const ROOT=modelsApiRoot();
export {modelsApiRoot,PRODUCTION_MODELS_ORIGIN};
export const CF_DEFAULTS=Object.freeze({chat:"chat_auto",work:"work_auto",code:"code_auto"});
const NEW_MODEL_IDS=new Set(["chat_granite","chat_think","cf_gptoss20","cf_gptoss120","cf_qwen3","cf_gemma4"]);
export const isNewCloudModel=id=>NEW_MODEL_IDS.has(id);
// Keep the known catalog visible for debugging; only server-confirmed Vercel models are enabled.
// No client-side model name can force a provider connection or spending.
const CATALOG=Object.freeze([
 ['chat_auto','chat','Auto · smart selection','malguard_auto'],
 ['work_auto','work','Auto · smart selection','malguard_auto'],
 ['code_auto','code','Auto · smart selection','malguard_auto'],
 ['chat_granite','chat','Granite 4 Micro · Efficient','workers_ai_rest'],
 ['chat_think','chat','GPT-OSS 20B · Deep Chat','workers_ai_rest'],
 ['chat_flash','chat','Gemini 3.5 Flash-Lite','gemini'],
 ['chat_nemotron','chat','Nemotron 3 Super · Chat · Free','openrouter'],
 ['work_qwen','work','Qwen3 30B · Work · Free','openrouter'],
 ['work_gemma','work','Gemini 3.8 Flash · Work','gemini'],
 ['code_gemini','code','Gemini 3.8 Flash · Coding','gemini'],
 ['code_super','code','Nemotron 3 Super 120B · Free','openrouter'],
 ['code_ultra','code','Nemotron 3 Ultra 550B · Free','openrouter'],
 ['llama70b','work','Llama 3.3 70B · Legacy','workers_ai'],
 ['llama8b','chat','Llama 3.1 8B · Legacy','workers_ai'],
 ['cf_gptoss120','code','GPT-OSS 120B · Strong Code','workers_ai_rest'],
 ['cf_gptoss20','work','GPT-OSS 20B · Efficient Work','workers_ai_rest'],
 ['cf_qwen3','work','Qwen3.8 27B · Multimodal Work','workers_ai_rest'],
 ['cf_granite','chat','Granite 4 Micro · Classic','workers_ai'],
 ['cf_llama3b','chat','Llama 3.2 3B · Fast','workers_ai'],
 ['cf_qwen_coder','code','Qwen2.5 Coder 32B · Classic','workers_ai'],
 ['cf_scout','work','Llama 4 Scout · Classic','workers_ai'],
 ['cf_mistral','work','Mistral Small 3.1 24B','workers_ai'],
 ['cf_nemotron','code','Nemotron 3 Super · Classic','workers_ai'],
 ['cf_glm','chat','GLM 4.7 Flash · Classic','workers_ai'],
 ['cf_gemma4','work','Gemma 4 26B · Balanced Work','workers_ai_rest'],
 ['gemini_flash','chat','Gemini Flash · Classic','gemini'],
 ['groq_qwen','work','Qwen 3.8 27B · Groq','groq'],
 ['groq_gptoss20','chat','GPT-OSS 20B · Groq','groq'],
 ['groq_gptoss20','work','GPT-OSS 20B · Groq · Work','groq'],
 ['groq_gptoss','code','GPT-OSS 120B · Groq','groq']
]);
const IDS=new Set(CATALOG.map(([id])=>id));
const MODES=new Map(CATALOG.map(([id,mode])=>[id,mode]));
export function unavailableCFModels(){
 return CATALOG.map(([id,mode,label,provider])=>({id,mode,label,provider,available:false}));
}
export async function fetchCFModels({fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(ROOT+"/api/public-models",{method:"GET",credentials:"omit",cache:"no-store",mode:"cors",signal});
 if(!response.ok)throw new Error("model_catalog_unavailable");
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
 Object.defineProperty(models,"searchAvailable",{value:data.search?.available===true&&data.search?.provider==="tavily",enumerable:false});
 Object.defineProperty(models,"mediaCapabilities",{value:Object.freeze({analyze:data.media?.analyze===true,generate:data.media?.generate===true}),enumerable:false});
 const thinkingByMode=Object.fromEntries(["chat","work","code"].map(mode=>[mode,data.thinking?.byMode?.[mode]===true&&data.thinking?.provider==="workers_ai_rest"]));
 Object.defineProperty(models,"thinkingByMode",{value:Object.freeze(thinkingByMode),enumerable:false});
 Object.defineProperty(models,"thinkingAvailable",{value:Object.values(thinkingByMode).some(Boolean),enumerable:false});
 return models;
}
function catalogAllows(model,mode){
 return CATALOG.some(([id,itemMode])=>id===model&&itemMode===mode);
}
function normalizeWebSearch(data){
 let webSearch;
 if(data?.webSearch?.state==="completed"&&Array.isArray(data.webSearch.sources)&&["web","research"].includes(data.webSearch.mode)){
  const sources=data.webSearch.sources.slice(0,8).map(item=>{
   try{
    const url=new URL(item.url);
    if(url.protocol!=="https:"||url.username||url.password||!url.hostname.includes("."))return null;
    return {citation:item.citation,title:String(item.title||url.hostname).slice(0,190),url:url.href,
      excerpt:String(item.excerpt||"").slice(0,850),checkedAt:item.checkedAt,publishedAt:item.publishedAt};
   }catch{return null;}
  }).filter(Boolean);
  if(sources.length)webSearch={state:"completed",provider:"tavily",mode:data.webSearch.mode,query:String(data.webSearch.query||"").slice(0,500),
   checkedAt:data.webSearch.checkedAt,sources};
 }
 return webSearch;
}
function finishModelResult(data,model){
 if(typeof data.text!=="string"||!data.text.trim()||typeof data.model!=="string"||typeof data.provider!=="string")throw Object.assign(new Error("provider_unavailable"),{code:"provider_unavailable"});
 const webSearch=normalizeWebSearch(data);
 return {text:data.text,model:data.model,selectedModel:data.modelId,provider:data.provider,fallbackUsed:!!data.fallback,thinkingUsed:data.thinking===true,thinkingModelId:typeof data.thinkingModelId==="string"?data.thinkingModelId:undefined,securityAnalysis:false,
  ...(data.auto?.selectedModelId&&typeof data.auto.selectedModelId==="string"?{auto:{selectedModelId:data.auto.selectedModelId,selectedLabel:String(data.auto.selectedLabel||"").slice(0,100)}}:{}),
  ...(webSearch?{webSearch}:{}),...(data.usage&&typeof data.usage.remainingTokens==="number"?{usage:data.usage}:{})};
}
async function readModelStream(response,model,{onToken,onStatus}={}){
 const reader=response.body.getReader();
 const decoder=new TextDecoder();
 let buffer="",text="",event="message",meta={};
 const apply=(payload,replace=false)=>{
  if(!payload||typeof payload!=="object")return;
  if(typeof payload.full==="string")text=payload.full;
  else if(replace&&typeof payload.text==="string")text=payload.text;
  else if(typeof payload.text==="string")text+=payload.text;
  else if(typeof payload.delta==="string")text+=payload.delta;
  if(payload.model)meta.model=payload.model;
  if(payload.provider)meta.provider=payload.provider;
  if(payload.modelId)meta.modelId=payload.modelId;
  if(payload.webSearch)meta.webSearch=payload.webSearch;
  if(payload.usage)meta.usage=payload.usage;
  if(payload.auto)meta.auto=payload.auto;
  if(payload.fallback!=null)meta.fallback=payload.fallback;
  if(payload.thinking!=null)meta.thinking=payload.thinking;
  if(payload.thinkingModelId)meta.thinkingModelId=payload.thinkingModelId;
 };
 const flush=block=>{
  let data="";
  for(const line of block.split(/\r?\n/)){
   if(line.startsWith("event:"))event=line.slice(6).trim()||"message";
   else if(line.startsWith("data:"))data+=(data?"\n":"")+line.slice(5).trimStart();
  }
  if(!data||data==="[DONE]"){event="message";return;}
  let payload={};
  try{payload=JSON.parse(data);}catch{payload={text:data};}
  if(event==="status"||payload.phase){if(typeof onStatus==="function")onStatus(payload);event="message";return;}
  if(event==="error"||payload.error){
   throw Object.assign(new Error(payload.error||"provider_unavailable"),{code:payload.error||"provider_unavailable",status:payload.status||500,retryAfterSeconds:payload.retryAfterSeconds,retryAt:payload.resetAt});
  }
  const previous=text;
  apply(payload,event==="done");
  if(typeof onToken==="function"&&text&&text!==previous)onToken(text);
  event="message";
 };
 while(true){
  const {value,done}=await reader.read();
  buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
  const parts=buffer.split(/\r?\n\r?\n/);
  buffer=parts.pop()||"";
  for(const block of parts)if(block.trim())flush(block);
  if(done){if(buffer.trim())flush(buffer);break;}
 }
 return finishModelResult({text,...meta,model:meta.model||model,provider:meta.provider||"unknown"},model);
}
export async function callCFModel({mode,model,message,history=[],sessionToken,quotaEnabled=false,freeFallback=false,thinking=false,webMode="off",searchQuery,remoteLookup=false,signal,fetchImpl=fetch,stream=false,onToken,onStatus}={}){
 if(!["chat","work","code"].includes(mode)||!IDS.has(model)||!catalogAllows(model,mode)||typeof message!=="string"||!message.trim()||message.length>5000)throw new Error("invalid_model_request");
 if(typeof sessionToken!=="string"||sessionToken.length<12)throw Object.assign(new Error("sign_in_required"),{code:"sign_in_required",status:401});
 if(typeof freeFallback!=="boolean"||typeof thinking!=="boolean")throw new Error("invalid_model_request");
 if(!["off","web","research"].includes(webMode)||typeof remoteLookup!=="boolean")throw new Error("invalid_model_request");
 if(webMode!=="off"&&(!remoteLookup||typeof searchQuery!=="string"||!searchQuery.trim()||searchQuery.length>500))throw new Error("web_consent_required");
 const body={mode,model,message,history:history.slice(-6).map(m=>({role:m.role,content:m.content})),consent:{modelShare:true,...(webMode!=="off"?{remoteLookup:true}:{})},...(freeFallback?{freeFallback:true}:{}),...(thinking?{thinking:true}:{}),...(webMode!=="off"?{webMode,searchQuery:searchQuery.trim()}:{}),...(stream?{stream:true}:{})};
 let response;
 try{
  response=await fetchImpl(ROOT+"/api/public-model-chat",{method:"POST",credentials:"omit",cache:"no-store",mode:"cors",signal,headers:{"Content-Type":"application/json",Accept:stream?"text/event-stream":"application/json",Authorization:"Bearer "+sessionToken},body:JSON.stringify(body)});
 }catch(error){
  if(error?.name==="AbortError")throw error;
  if(error?.name==="TimeoutError")throw Object.assign(new Error("provider_timeout"),{code:"provider_timeout",status:504});
  throw Object.assign(new Error("network_error"),{code:"network_error"});
 }
 const type=String(response.headers.get("content-type")||"");
 if(stream&&response.ok&&response.body&&/event-stream|ndjson|x-ndjson/i.test(type)){
  return readModelStream(response,model,{onToken,onStatus});
 }
 let data;try{data=await response.json();}catch{throw new Error("provider_invalid_response");}
 if(!response.ok){const code=typeof data?.error==="string"?data.error:response.status===401?"sign_in_required":"provider_unavailable";
  throw Object.assign(new Error(code),{code,status:response.status,retryAfterSeconds:data?.retryAfterSeconds,retryAt:typeof data?.resetAt==="string"?data.resetAt:undefined});}
 const result=finishModelResult(data,model);
 if(typeof onToken==="function")onToken(result.text);
 return result;
}

export async function fetchCFUsage({sessionToken,signal,fetchImpl=fetch}={}){
 if(typeof sessionToken!=="string"||!sessionToken)throw new Error("sign_in_required");
 const response=await fetchImpl(ROOT+"/api/account-usage",{method:"GET",credentials:"omit",cache:"no-store",mode:"cors",signal,headers:{Authorization:"Bearer "+sessionToken}});
 if(!response.ok)throw new Error(response.status===401?"sign_in_required":"quota_unavailable");
 const data=await response.json();
 if(!Number.isSafeInteger(data.limitTokens)||!Number.isSafeInteger(data.remainingTokens)||!Number.isSafeInteger(data.usedTokens)||data.limitTokens<0||data.remainingTokens<0||data.remainingTokens>data.limitTokens||typeof data.resetAt!=="string")throw new Error("invalid_usage");
 return {limitTokens:data.limitTokens,remainingTokens:data.remainingTokens,usedTokens:data.usedTokens,resetAt:data.resetAt,estimated:true};
}
