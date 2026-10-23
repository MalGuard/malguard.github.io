import {httpFailure} from '../../../../ai/service-errors.mjs';
import {report,text,publicUrl} from '../contracts.js';
import {fetchPublic} from '../../../game-scam-guard/server/network.js';
import {gatewayRequest,gatewayStatus,refreshGateway} from '../provider-gateway.js';
export function createAiWeb({env=process.env,transport=fetchPublic}={}){
  const remote=!!env.VERCEL&&!env.TAVILY_API_KEY;
  const status=()=>({state:env.TAVILY_API_KEY||remote&&gatewayStatus()?.searchConfigured?'configured':'disabled',reason:env.TAVILY_API_KEY||remote&&gatewayStatus()?.searchConfigured?'live_not_verified':'missing_credential',provider:'tavily',liveVerified:false});
  return {status,...(remote?{refresh:refreshGateway}:{}),async run(input,{signal}){
    if(status().state==='disabled')return report('ai_web','insufficient',{reason:'search_not_authorized_or_configured',limitations:['No web search was performed.']});
    if(!input.query)return report('ai_web','insufficient',{reason:'query_required'});
    const body=JSON.stringify({query:input.query,search_depth:'basic',max_results:5,include_answer:false,include_raw_content:false});
    let data;
    if(remote)data=await gatewayRequest({operation:'search',query:input.query,consent:{remoteLookup:true}},{signal});
    else{const response=await transport('https://api.tavily.com/search',{method:'POST',noRedirect:true,limit:256*1024,totalTimeout:10000,timeout:8000,signal,headers:{Authorization:`Bearer ${env.TAVILY_API_KEY}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},body});if(response.status!==200){let details;try{details=JSON.parse(response.bytes.toString('utf8'));}catch{}throw httpFailure(response.status,response.headers,details);}data=JSON.parse(response.bytes.toString('utf8'));}
    if(!Array.isArray(data.results))throw new Error('invalid_search_response');
    const results=data.results.slice(0,5).flatMap(row=>{try{return [{title:text(row.title,200),url:publicUrl(row.url),excerpt:text(row.content,800)}];}catch{return [];}});
    return report('ai_web','insufficient',{sources:results.map(r=>({name:r.title||r.url,url:r.url,status:'search_result'})),evidence:results.map(r=>({rule:'search_excerpt',detail:r.excerpt})),metadata:{provider:'tavily',results:results.length},limitations:['Web search excerpts are untrusted third-party information, not security findings. Source pages were not independently retrieved or verified. No generated answer is included.']});
  }};
}
export const aiWeb=createAiWeb();
