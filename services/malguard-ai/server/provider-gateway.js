import {fetchPublic} from '../../game-scam-guard/server/network.js';
const ENDPOINT='https://malware-ai-gray.vercel.app/api/malguard-assistant';
let cache,loading,until=0;
export async function gatewayRequest(payload,{transport=fetchPublic,signal}={}){
 const body=JSON.stringify(payload);
 const response=await transport(ENDPOINT,{method:'POST',noRedirect:true,limit:256*1024,timeout:22000,totalTimeout:24000,signal,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),Origin:'https://game-scam-guard-connected.vercel.app'},body});
 if(response.status!==200)throw new Error('provider_gateway_failed');
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
export const remoteModel={refresh:refreshGateway,status:()=>({state:cache?.modelConfigured?'configured':'disabled',provider:cache?.modelConfigured?'workers_ai':null,model:cache?.model||null,reason:cache?.modelConfigured?'gateway_connected':'provider_gateway_unavailable',liveVerified:false}),async respond(message,locale,history=[]){const data=await gatewayRequest({operation:'chat',message,locale,history,consent:{modelShare:true}});if(typeof data.generated?.text!=='string'||data.generated.text.length>6000||data.generated.provider!=='workers_ai')throw new Error('invalid_model_response');return {...data.generated,securityAnalysis:false};}};
