import {randomUUID,createHash} from 'node:crypto';
import {renderPreview} from './browser.js';
import {inspectionLayers} from './inspection-layers.js';
import {createReportTokens,reportTokens} from './report-token.js';
import {fetchPublic,normalizeUrl,resolvePublic,ScanError} from './network.js';
import {parsePage} from './scanner.js';
import {lookupReputation} from './threat-intel.js';
import {assessPage} from './page-assessment.js';
import {inspectRedirectReputation,reportReputations} from './redirect-intel.js';

export const jobTokens=createReportTokens({maxBytes:1024*1024});
const MAX_TARGETS=128,MAX_TOTAL_BYTES=96*1024*1024;
const clone=value=>JSON.parse(JSON.stringify(value));

function conciseResult(result){
  // Every target remains represented. Large nested evidence is explicitly
  // counted as omitted rather than silently consuming an unbounded capability.
  const copy=clone(result);
  if(copy.artifact){
    delete copy.artifact.details;
    const entries=copy.artifact.archive?.entries||[];
    const findings=copy.artifact.findings||[];
    let omittedEntries=0,omittedFindings=0;
    while(Buffer.byteLength(JSON.stringify(copy))>6000&&(entries.length||findings.length)){
      if(entries.length){entries.pop();omittedEntries++;}else{findings.pop();omittedFindings++;}
    }
    copy.artifact.reportOmittedEntries=omittedEntries;copy.artifact.reportOmittedFindings=omittedFindings;
  }
  if(copy.findings){let omitted=0;while(Buffer.byteLength(JSON.stringify(copy))>6000&&copy.findings.length){copy.findings.pop();omitted++;}copy.reportOmittedFindings=omitted;}
  if(copy.behavior){let omitted=0;while(Buffer.byteLength(JSON.stringify(copy))>6000&&copy.behavior.createdFiles?.length){copy.behavior.createdFiles.pop();omitted++;}copy.behavior.reportOmittedFiles=omitted;if(Buffer.byteLength(JSON.stringify(copy))>6000&&copy.behavior.untrustedOutputExcerpt){copy.behavior.untrustedOutputExcerpt=copy.behavior.untrustedOutputExcerpt.slice(0,256);copy.behavior.outputExcerptLimited=true;}}
  if(copy.artifact){let omitted=0;while(Buffer.byteLength(JSON.stringify(copy))>6000&&copy.artifact.observedUrls?.length){copy.artifact.observedUrls.pop();omitted++;}while(Buffer.byteLength(JSON.stringify(copy))>6000&&copy.artifact.layers?.length){copy.artifact.layers.pop();omitted++;}copy.artifact.reportOmittedLayers=omitted;}
  if(copy.finalUrl===copy.url)delete copy.finalUrl;
  return copy;
}

export function startScanJob({id,token,mode='advanced',consent}={}, {readReport=(token,id)=>reportTokens.read(token,id).result,codec=jobTokens,now=Date.now}={}){
  if(consent!==true)throw new ScanError('برای بررسی مقصدهای عمومی لینک، رضایت شما لازم است.',400);
  if(mode!=='advanced')throw new ScanError('حالت بررسی معتبر نیست.',400);
  const report=readReport(token,id);
  if(report.pageFetch?.status==='unavailable')throw new ScanError('محتوای صفحه دریافت نشده است؛ هنوز مقصدی برای ادامهٔ بررسی نداریم.',409);
  const targets=[];const seen=new Set();let omitted=report.linkInventory?.omitted||0;let excluded=0;
  const add=(item,kind)=>{
    if(!item.url){omitted++;return;}
    let url;try{url=normalizeUrl(item.url).href;}catch{url=item.url;}
    if(seen.has(url))return;seen.add(url);
    if(url===report.url||url===report.finalUrl){excluded++;return;}
    if(targets.length===MAX_TARGETS){omitted++;return;}
    targets.push({id:item.id||randomUUID(),url,kind,name:(item.name||item.label||new URL(url).pathname.split('/').pop()||'صفحه').slice(0,180),status:'queued'});
  };
  // GameScam Guard is website-only: do not retrieve or analyze file targets.
  for(const link of report.linkInventory?.links||[])if(link.kind==='page')add(link,'page');else excluded++;
  const parent={...clone(report),files:[]};delete parent.scanToken;delete parent.preview?.image;
  const state={id:randomUUID(),kind:'scan-job',mode,parent,targets,results:[],files:[],next:0,bytesRead:0,omittedTargets:omitted,excludedTargets:excluded,createdAt:new Date(now()).toISOString(),events:[],done:targets.length===0};
  return jobDto(state,codec);
}

function jobDto(state,codec){
  const targets=new Map(state.targets.map(target=>[target.id,target]));
  const snapshot=clone(state);delete snapshot.parent?.preview?.image;
  return {...state,results:state.results.map(result=>({...targets.get(result.id),...result})),token:codec.issue(snapshot)};
}

export async function inspectJobTarget(target,{transport=fetchPublic,urlLookup=lookupReputation,validate=resolvePublic,maxBytes=2*1024*1024,signal,onEvent=()=>{}}={}){
  const result={id:target.id,url:target.url,name:target.name,kind:target.kind,status:'unavailable'};
  let timer;
  try{await Promise.race([validate(normalizeUrl(target.url)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ScanError('نام دامنه در زمان مجاز پاسخ نداد.')),5000);})]);}
  catch(error){return {...result,status:error.status===400?'blocked':'unavailable',detail:error instanceof ScanError?error.message:'آدرس مقصد قابل بررسی نبود.'};}
  finally{clearTimeout(timer);}
  onEvent({phase:'receive',message:`دریافت ${target.name}`});
  const intelPromise=Promise.resolve().then(()=>urlLookup(target.url)).catch(()=>({status:'unavailable',message:'استعلام لینک کامل نشد.'}));
  try{
    const response=await transport(target.url,{limit:Math.min(2*1024*1024,maxBytes),htmlLimit:Math.min(2*1024*1024,maxBytes),htmlOnly:true,totalTimeout:20000,timeout:10000,signal});
    result.bytesRead=response.bytes.length;result.finalUrl=response.url;
    result.reputation=await intelPromise;
    Object.assign(result,await inspectRedirectReputation(target.url,response,result.reputation,{lookup:urlLookup,onEvent}));
    const knownUrlThreat=reportReputations(result).some(item=>item.status==='listed');
    const mime=String(response.headers['content-type']||'').toLowerCase();
    const html=mime.includes('html')||/^\s*<!doctype html|^\s*<html/i.test(response.bytes.toString('utf8',0,120));
    if(html){
      onEvent({phase:'content_analysis',message:'تحلیل مستقل صفحهٔ مقصد'});
      if(response.bytes.length>2*1024*1024)throw new ScanError('صفحهٔ مقصد از سقف تحلیل HTML بیشتر است.');
      const page=parsePage(response.bytes,response.url,response.headers);
      result.title=page.title;result.kind='page';result.linkCount=page.linkCount;result.fileCount=page.fileCount;result.siteAnalysis=page.siteAnalysis;result.analysisEngine=page.analysisEngine;
      const assessed=assessPage({signals:page.signals,analysisEngine:page.analysisEngine,redirects:response.redirects,reputation:result.reputation,finalReputation:result.finalReputation,urlReputations:result.urlReputations});
      // Keep all bounded HTML findings, including the reason for a redirect or
      // threat verdict; a linked-page report must not silently lose its evidence.
      result.findings=assessed.signals;
      result.status=assessed.status;
      result.detail=target.kind==='file'?'مقصد به‌جای فایل یک صفحهٔ HTML برگرداند؛ ممکن است ورود یا دسترسی دیگری لازم باشد.':'محتوای این مقصد دریافت و تحلیل شد؛ لینک‌های داخل آن خودکار دنبال نشده‌اند.';
    }else{
      // A page destination changed into a direct download. Do not receive, hash,
      // parse, upload, or execute it in this website-only product.
      result.kind='file';result.status=knownUrlThreat?'danger':'unavailable';
      result.detail='The destination is a direct file. GameScam Guard did not retrieve or analyze it; use GTA Guard for file analysis.';
    }
    return conciseResult(result);
  }catch(error){
    if(Number.isSafeInteger(error.bytesRead))result.bytesRead=Math.max(result.bytesRead||0,error.bytesRead);
    result.reputation=await intelPromise;
    if(error.remoteStatus===401||error.remoteStatus===403)result.accessRequirement='requires_access';
    else if(error.remoteStatus===402)result.accessRequirement='requires_payment';
    const knownThreat=[...reportReputations(result),result.fileReputation].some(item=>item?.status==='listed');
    result.failureStatus=error.status===400?'blocked':result.accessRequirement||'unavailable';
    result.status=knownThreat?'danger':result.failureStatus;
    const failure=error instanceof ScanError?error.message:'دریافت یا تحلیل این مقصد کامل نشد؛ امنیت تأیید نمی‌شود.';
    const threatEvidence=[...reportReputations(result),result.fileReputation].filter(intel=>intel?.status==='listed').map(intel=>intel.message);
    result.detail=[...threatEvidence,failure].join(' ');
    return result;
  }
}

export async function stepScanJob({id,token}={}, {codec=jobTokens,inspect=inspectJobTarget,onEvent=()=>{},signal,now=Date.now}={}){
  const state=codec.read(token,id).result;delete state.scanToken;
  if(state.kind!=='scan-job'||!Array.isArray(state.targets)||!Number.isInteger(state.next))throw new ScanError('شناسهٔ صف معتبر نیست.',400);
  if(now()-new Date(state.createdAt).getTime()>30*60*1000)throw new ScanError('زمان صف تمام شده است؛ دوباره بررسی کنید.',404);
  const emit=event=>{const value={seq:(state.events.at(-1)?.seq||0)+1,at:new Date(now()).toISOString(),...event};state.events.push(value);if(state.events.length>160)state.events.shift();onEvent(value);};
  const end=Math.min(state.next+4,state.targets.length);const started=now();const first=state.next;
  for(;state.next<end;state.next++){
    // Leave room within the 180-second function budget for a destination's
    // public fetch, final-URL lookup, bounded parser and hash intelligence.
    if(state.next>first&&now()-started>85000)break;
    if(signal?.aborted)throw new ScanError('بررسی لغو شد؛ از آخرین مرحلهٔ ذخیره‌شده می‌توانید ادامه دهید.',409);
    const target=state.targets[state.next];emit({phase:'item_started',message:`بررسی مقصد ${state.next+1} از ${state.targets.length}`,targetId:target.id,completed:state.next,total:state.targets.length});
    let result;
    if(state.bytesRead>=MAX_TOTAL_BYTES)result={...target,status:'budget_exceeded',detail:'سقف مجموع دریافت ۹۶ مگابایت رسیده است؛ این مقصد بررسی نشده است.'};
    else result=await inspect(target,{signal,maxBytes:Math.min(2*1024*1024,MAX_TOTAL_BYTES-state.bytesRead),onEvent:event=>emit({...event,targetId:target.id})});
    state.bytesRead+=result.bytesRead||0;delete result.bytesRead;

    target.status=result.status;if(result.kind==='file'&&result.name)target.name=result.name;const stored={...result};delete stored.url;delete stored.name;state.results.push(stored);emit({phase:'item_finished',message:`نتیجهٔ مقصد ${state.next+1} ثبت شد`,targetId:target.id,status:result.status,completed:state.next+1,total:state.targets.length});
  }
  state.done=state.next===state.targets.length;
  emit({phase:state.done?'completed':'batch_completed',message:state.done?'گزارش همهٔ مقصدهای صف آماده شد.':'این دسته بررسی شد؛ دستهٔ بعدی قابل ادامه است.'});
  return jobDto(state,codec);
}

export function scanJobReport(job){
  const report={...job.parent,advanced:true,scanMode:job.mode,createdAt:job.parent.createdAt,advancedAt:new Date().toISOString(),destinationResults:job.results,jobSummary:{total:job.targets.length,completed:job.results.length,omitted:job.omittedTargets,bytesRead:job.bytesRead,excluded:job.excludedTargets||0,done:job.done},progressEvents:job.events,files:[]};
  report.files=[];
  report.fileCount=0;
  const threats=job.results.filter(item=>item.status==='danger');
  const warnings=job.results.filter(item=>item.status==='warning');
  const incomplete=job.results.filter(item=>['unavailable','blocked','requires_access','requires_payment','budget_exceeded'].includes(item.status));
  const initialStatus=job.parent.status;
  if(initialStatus==='danger'||threats.length)report.status='danger';
  else if(initialStatus==='warning'||warnings.length)report.status='warning';
  else if(initialStatus==='unavailable'||!job.done||job.omittedTargets||incomplete.length)report.status='unavailable';
  report.initialAssessment={status:initialStatus,scope:'submitted-page'};
  report.linkedAssessment={status:report.status,threats:threats.length,warnings:warnings.length,incomplete:incomplete.length,omitted:job.omittedTargets,excluded:job.excludedTargets||0,
    reason:threats.length?'Known threat evidence was found on a linked page.':warnings.length?'Additional caution indicators were found on linked pages.':incomplete.length||job.omittedTargets||!job.done?'Some linked pages could not be inspected. This is a coverage gap, not evidence of malware.':'No additional threat or caution indicators were found on the inspected linked pages.'};
  report.inspectionLayers=inspectionLayers(report);
  report.limitations=[...report.limitations,'گزارش صف فقط مقصدهای ثبت‌شدهٔ همین صفحه را پوشش می‌دهد؛ خزش بی‌پایان انجام نشده است.'];
  report.checks=[...report.checks,{title:'بررسی مقصدهای صف',status:job.done?'done':'unavailable',detail:`${job.results.length} نتیجه از ${job.targets.length} مقصد یکتا ثبت شد؛ ${job.bytesRead} بایت دریافت شد.`}];
  if(report.linkInventory){report.linkInventory={...report.linkInventory,status:'checked-targets',links:report.linkInventory.links.map(link=>{const result=job.results.find(result=>result.url===link.url);return result?{...link,status:result.status}:link;})};}
  delete report.scanToken;
  return report;
}

// Upgrade the browser evidence without silently replacing the original page verdict.
// A fresh page must match the signed report's exact HTML before it can be rendered.
export async function prepareJobPreview(job,{codec=jobTokens,transport=fetchPublic,preview=renderPreview}={}){
  const state=codec.read(job.token,job.id).result;
  const parent=state.parent;
  if(parent.status==='danger'||parent.preview?.status==='done'||!parent.siteAnalysis?.htmlSha256)return job;
  try{
    const page=await transport(parent.finalUrl,{htmlOnly:true,totalTimeout:12000,timeout:6000});
    if(page.url!==parent.finalUrl||createHash('sha256').update(page.bytes).digest('hex')!==parent.siteAnalysis.htmlSha256){
      parent.preview={status:'unavailable',detail:'The page changed since the initial scan. Run a new scan for a matching browser snapshot.'};
    }else parent.preview=await preview(page.url,page.bytes);
  }catch{parent.preview={status:'unavailable',detail:'The isolated browser preview was unavailable. The original HTML evidence and verdict were preserved.'};}
  parent.inspectionLayers=inspectionLayers(parent);
  return jobDto(state,codec);
}
