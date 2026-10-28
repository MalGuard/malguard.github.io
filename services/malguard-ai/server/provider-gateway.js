import {ServiceError,httpFailure,publicFailure} from '../../../ai/service-errors.mjs';
import {fetchPublic} from '../../game-scam-guard/server/network.js';
import {planCloudChat} from '../../../ai/routing.mjs';
const ENDPOINT='https://malware-ai-gray.vercel.app/api/malguard-assistant';
let cache,loading,until=0;
export async function gatewayRequest(payload,{transport=fetchPublic,signal}={}){
 const body=JSON.stringify(payload);
 const response=await transport(ENDPOINT,{method:'POST',noRedirect:true,limit:256*1024,timeout:48000,totalTimeout:50000,signal,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),Origin:'https://game-scam-guard-connected.vercel.app'},body});
 if(response.status!==200){
  let data;try{data=JSON.parse(response.bytes.toString('utf8'));}catch{}
  const details=publicFailure(data);
  if(details.error!=='provider_unavailable')throw new ServiceError(details.error,response.status,details);
  throw httpFailure(response.status,response.headers,data);
 }
 return JSON.parse(response.bytes.toString('utf8'));
}
export async function refreshGateway(){
 if(Date.now()<until)return;
 if(!loading)loading=(async()=>{
  try{const response=await fetchPublic(ENDPOINT,{noRedirect:true,limit:8192,timeout:4000,totalTimeout:5000});if(response.status!==200)throw new Error();cache=JSON.parse(response.bytes.toString('utf8'));}
  catch{cache=undefined;}finally{until=Date.now()+15000;}
 })().finally(()=>{loading=undefined;});
 await loading;
}
export const gatewayStatus=()=>cache;
export const remoteModel={
 refresh:refreshGateway,
 status:()=>({state:cache?.modelConfigured?'configured':'disabled',provider:cache?.modelConfigured?cache.provider:null,model:cache?.model||null,defaultModel:cache?.defaultModel||'llama70b',models:cache?.models||[],reason:cache?.modelConfigured?'gateway_connected':'provider_gateway_unavailable',liveVerified:false}),
 async respond(message,locale,history=[],model='llama70b',consent={}){
  const selected=cache?.models?.find(m=>m.id===model);
  const fallbackByModel={gemini_flash:'cf_qwen3',groq_qwen:'cf_qwen3',groq_gptoss:'cf_gptoss120'};
  const alternate=selected?.reason==='missing_credential'&&cache.models.find(m=>m.id===fallbackByModel[model]&&m.state==='configured');
  if(!selected||selected.state!=='configured'&&!alternate)throw new ServiceError('model_not_configured',503);
  const data=await gatewayRequest({operation:'chat',message,locale,history:history.slice(-8),model,...(consent.routingMode==='build'?{routingMode:'build',...(consent.routingText?{routingText:consent.routingText}:{})}:{}),consent:{modelShare:true,remoteLookup:consent.remoteLookup===true}});
  const planned=model==='auto'?planCloudChat(consent.routingText??message,history.slice(-8),{models:cache.models,mode:consent.routingMode}).model:model;
  const actual=cache.models.find(m=>m.id===data.generated?.selectedModel&&m.state==='configured');
  const allowed=model==='auto'&&(data.generated?.selectedModel===planned||data.generated?.routing?.fallbackFrom===planned&&['cf_granite','groq_gptoss','gemini_flash'].includes(data.generated?.selectedModel))||model!=='auto'&&(data.generated?.selectedModel===model||alternate&&data.generated?.selectedModel===alternate.id&&data.generated?.fallbackFrom===model);
  if(!actual||!allowed||typeof data.generated?.text!=='string'||data.generated.text.length>6000||data.generated.provider!==actual.provider||model==='auto'&&data.generated.requestedModel!=='auto')throw new Error('invalid_model_response');
  return {...data.generated,securityAnalysis:false};
 }
};

