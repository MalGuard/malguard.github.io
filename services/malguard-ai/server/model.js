import {httpFailure} from '../../../ai/service-errors.mjs';
import {fetchPublic} from '../../game-scam-guard/server/network.js';
import {createWorkersModel} from './workers-model.js';
import {remoteModel} from './provider-gateway.js';
// Reuses the existing Vercel variable name. Never enable OpenAI or paid fallback.
export function createModel({env=process.env,transport=fetchPublic}={}) {
  if(env.VERCEL&&!env.MALGUARD_WORKER_PROXY_TOKEN&&(!env.MALGUARD_AI_MODEL_PROVIDER||env.MALGUARD_AI_MODEL_PROVIDER==='workers_ai'))return remoteModel;
  if(!env.MALGUARD_AI_MODEL_PROVIDER||env.MALGUARD_AI_MODEL_PROVIDER==='workers_ai')return createWorkersModel({env,transport});
  const status=()=>{
    const configured=env.MALGUARD_AI_MODEL_PROVIDER==='gemini'&&!!env.GEMINI_API_KEY && /^[a-zA-Z0-9.-]{1,100}$/.test(env.MALGUARD_AI_GEMINI_MODEL||'');
    return {state:configured?'configured':'disabled',provider:configured?'gemini':null,model:configured?env.MALGUARD_AI_GEMINI_MODEL:null,reason:configured?'live_not_verified':'free_model_not_authorized_or_configured',mode:'deterministic_tool_routing',liveVerified:false};
  };
  return {status,async respond(message,locale,history=[]){
    if(status().state==='disabled')return null;
    const body=JSON.stringify({systemInstruction:{parts:[{text:`You are MalGuard AI. Reply naturally in ${locale==='fa'?'Persian':'English'} and help with general and technical questions. Default to concise natural paragraphs, with headings or lists only when they help the user. Security tools run separately. Never invent checks, security verdicts, safety guarantees, engine counts or confidence scores. Never request secrets.`}]},contents:[...history.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),{role:'user',parts:[{text:message}]}],generationConfig:{maxOutputTokens:600}});
    const response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${env.MALGUARD_AI_GEMINI_MODEL}:generateContent`,{method:'POST',noRedirect:true,limit:128*1024,totalTimeout:18000,timeout:15000,headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY,'Content-Length':Buffer.byteLength(body)},body});
    if(response.status!==200){let details;try{details=JSON.parse(response.bytes.toString('utf8'));}catch{}throw httpFailure(response.status,response.headers,details);}
    const data=JSON.parse(response.bytes.toString('utf8'));
    const parts=data.candidates?.[0]?.content?.parts;
    if(!Array.isArray(parts)||data.candidates[0].finishReason!=='STOP')throw new Error('model_incomplete');
    const value=parts.filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join('').slice(0,6000);
    if(!value.trim())throw new Error('model_empty');
    return {text:value,provider:'gemini',model:env.MALGUARD_AI_GEMINI_MODEL,checkedAt:new Date().toISOString(),securityAnalysis:false};
  }};
}
export const modelAdapter=createModel();
