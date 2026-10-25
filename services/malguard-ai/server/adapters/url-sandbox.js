import {scanSite} from '../../../game-scam-guard/server/scanner.js';
import {renderCloudPreview} from '../../../game-scam-guard/server/cloud-browser.js';
import {fetchPublic} from '../../../game-scam-guard/server/network.js';
import {lookupReputation,lookupUrl} from '../../../game-scam-guard/server/threat-intel.js';
import {InputError,report,text} from '../contracts.js';
const source={name:'MalGuard isolated browser snapshot',url:'https://github.com/MalGuard/malguard.github.io/tree/main/services/game-scam-guard/server'};
export function createUrlSandbox({scan=scanSite,preview=renderCloudPreview,env=process.env}={}){
 const enabled=()=>env.GUARD_CLOUD_PREVIEW_ENABLED==='true'&&!!env.GUARD_BROWSER_SNAPSHOT_ID;
 return {
  status:()=>({state:enabled()?'configured':'disabled',scope:'isolated_html_snapshot_no_javascript',liveVerified:false}),
  async run(input,{signal,consent}={}){
   if(!consent?.isolatedExecution)throw new InputError('isolated_execution_consent_required',403);
   if(!consent.websiteFetch)throw new InputError('website_consent_required',403);
   if(!input.url)return report('url_sandbox','insufficient',{reason:'url_required',sources:[{...source,status:'not_checked'}],metadata:{executed:false,attempted:false}});
   if(!enabled())return report('url_sandbox','insufficient',{reason:'isolation_unavailable',sources:[{...source,status:'unavailable'}],metadata:{executed:false,attempted:false},limitations:['Cloud preview is disabled or its prepared snapshot is unavailable. No browser was started.']});
   const transport=(url,options={})=>fetchPublic(url,{...options,signal:signal&&options.signal?AbortSignal.any([signal,options.signal]):signal||options.signal});
   let attempted=false;
   const result=await scan(input.url,{transport,allowCloudPreview:true,allowThreatContent:false,retainReport:false,preview:async(...args)=>{attempted=true;return preview(...args);},lookup:consent.remoteLookup?value=>lookupReputation(value,{urlhaus:url=>lookupUrl(url,{transport})}):async()=>({status:'unconfigured',sources:[],message:'No threat-database consent.'})});
   const p=result.preview||{},ready=p.status==='done',findings=(result.signals||[]).filter(s=>s.level==='danger'||result.pageFetch?.status==='done'&&s.level==='warning');
   const isolation=p.isolation?{javaScriptEnabled:p.isolation.javaScriptEnabled===true,networkPolicy:p.isolation.networkPolicy==='deny-all'?'deny-all':'unverified',siteScriptsExecuted:p.isolation.siteScriptsExecuted===true,documentServed:p.isolation.documentServed===true,blockedRequests:Number.isSafeInteger(p.isolation.blockedRequests)?Math.max(0,p.isolation.blockedRequests):null}:null;
   return report('url_sandbox',findings.length?'suspicious':'insufficient',{reason:ready?'snapshot_observed_no_verdict':'preview_unavailable',sources:[{...source,status:ready?'completed':'unavailable'}],evidence:findings.slice(0,24).map(s=>({rule:text(s.rule||s.level,80),detail:text(s.detail),observation:text(s.title,160)})),metadata:{executed:false,attempted,previewRendered:ready,pageReceived:result.pageFetch?.status==='done',...(isolation?{isolation}:{})},limitations:[...(result.limitations||[]).slice(0,12).map(v=>text(v)),text(p.detail),'Only already-fetched public HTML is rendered. Site JavaScript, login, purchases and downloads are disabled.','Raw HTML, screenshot bytes and browser output are not returned or sent to a language model.','Explicit VM teardown is attempted by the preview module but is not independently confirmed in this report.']});
  }
 };
}
