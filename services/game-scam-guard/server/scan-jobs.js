import {randomUUID} from 'node:crypto';
import {createReportTokens,reportTokens} from './report-token.js';
import {fetchPublic,normalizeUrl,resolvePublic,ScanError} from './network.js';
import {parsePage} from './scanner.js';
import {lookupUrl,lookupFileHash} from './threat-intel.js';
import {analyzeArtifact} from './artifact-analysis.js';
import {runCloudBehavior} from './cloud-execution.js';
import {routeFile} from './file-routing.js';
import {receivedFilename} from './received-filename.js';

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

export function startScanJob({id,token,mode='advanced',consent,behaviorConsent=false}={}, {readReport=(token,id)=>reportTokens.read(token,id).result,codec=jobTokens,now=Date.now}={}){
  if(consent!==true)throw new ScanError('برای دریافت فایل‌ها و مقصدهای لینک، رضایت شما لازم است.',400);
  if(!['advanced','ultra'].includes(mode))throw new ScanError('حالت بررسی معتبر نیست.',400);
  const report=readReport(token,id);
  if(report.pageFetch?.status==='unavailable')throw new ScanError('محتوای صفحه دریافت نشده است؛ هنوز مقصدی برای ادامهٔ بررسی نداریم.',409);
  const targets=[];const seen=new Set();let omitted=report.fileCount===report.linkCount&&report.files.length===report.fileCount?0:report.linkInventory?.omitted||0;
  const add=(item,kind)=>{
    if(!item.url)return;
    let url;try{url=normalizeUrl(item.url).href;}catch{url=item.url;}
    if(seen.has(url))return;seen.add(url);
    if(targets.length===MAX_TARGETS){omitted++;return;}
    targets.push({id:item.id||randomUUID(),url,kind,name:(item.name||item.label||new URL(url).pathname.split('/').pop()||'صفحه').slice(0,180),status:'queued'});
  };
  for(const file of report.files)add(file,'file');
  for(const link of report.linkInventory?.links||[])if(link.kind!=='unsupported')add(link,link.kind);else omitted++;
  const parent={...report,files:[]};delete parent.scanToken;delete parent.preview?.image;
  const state={id:randomUUID(),kind:'scan-job',mode,behaviorConsent:behaviorConsent===true,cloudAttempts:0,files:[],parent,targets,results:[],next:0,bytesRead:0,omittedTargets:omitted,createdAt:new Date(now()).toISOString(),events:[],done:targets.length===0};
  return jobDto(state,codec);
}

function jobDto(state,codec){const targets=new Map(state.targets.map(target=>[target.id,target]));return {...state,results:state.results.map(result=>({...targets.get(result.id),...result})),token:codec.issue(state)};}

export async function inspectJobTarget(target,{transport=fetchPublic,urlLookup=lookupUrl,hashLookup=lookupFileHash,analyze=analyzeArtifact,validate=resolvePublic,behavior=runCloudBehavior,mode='advanced',behaviorConsent=false,cloudBudget=1,maxBytes=12*1024*1024,signal,onEvent=()=>{}}={}){
  const result={id:target.id,url:target.url,name:target.name,kind:target.kind,status:'unavailable'};
  let timer;
  try{await Promise.race([validate(normalizeUrl(target.url)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ScanError('نام دامنه در زمان مجاز پاسخ نداد.')),5000);})]);}
  catch(error){return {...result,status:error.status===400?'blocked':'unavailable',detail:error instanceof ScanError?error.message:'آدرس مقصد قابل بررسی نبود.'};}
  finally{clearTimeout(timer);}
  onEvent({phase:'receive',message:`دریافت ${target.name}`});
  const intelPromise=Promise.resolve().then(()=>urlLookup(target.url)).catch(()=>({status:'unavailable',message:'استعلام لینک کامل نشد.'}));
  try{
    const response=await transport(target.url,{limit:Math.min(12*1024*1024,maxBytes),htmlLimit:Math.min(2*1024*1024,maxBytes),totalTimeout:20000,timeout:10000,signal});
    result.bytesRead=response.bytes.length;result.finalUrl=response.url;
    result.reputation=await intelPromise;
    if(response.url!==target.url){
      onEvent({phase:'final_url_lookup',message:'استعلام URLhaus برای مقصد نهایی انتقال لینک'});
      result.finalReputation=await Promise.resolve().then(()=>urlLookup(response.url)).catch(()=>({status:'unavailable',message:'استعلام URLhaus برای مقصد نهایی کامل نشد.'}));
    }
    const knownUrlThreat=[result.reputation.status,result.finalReputation?.status].includes('listed');
    const mime=String(response.headers['content-type']||'').toLowerCase();
    const html=mime.includes('html')||/^\s*<!doctype html|^\s*<html/i.test(response.bytes.toString('utf8',0,120));
    if(html){
      onEvent({phase:'content_analysis',message:'تحلیل مستقل صفحهٔ مقصد'});
      if(response.bytes.length>2*1024*1024)throw new ScanError('صفحهٔ مقصد از سقف تحلیل HTML بیشتر است.');
      const page=parsePage(response.bytes,response.url,response.headers);
      result.title=page.title;result.kind='page';result.linkCount=page.linkCount;result.fileCount=page.fileCount;result.siteAnalysis=page.siteAnalysis;
      result.findings=page.signals.slice(0,12);
      result.status=knownUrlThreat?'danger':target.kind==='file'||page.signals.some(s=>s.level==='warning')?'warning':'limited';
      result.detail=target.kind==='file'?'مقصد به‌جای فایل یک صفحهٔ HTML برگرداند؛ ممکن است ورود یا دسترسی دیگری لازم باشد.':'محتوای این مقصد دریافت و تحلیل شد؛ لینک‌های داخل آن خودکار دنبال نشده‌اند.';
    }else{
      result.kind='file';result.name=receivedFilename(response,target.name);onEvent({phase:'file_analysis',message:'بررسی محتوای فایل و آرشیو'});
      const artifact=await analyze(response.bytes,result.name);
      onEvent({phase:'hash_lookup',message:'استعلام هش فایل'});
      const intel=await Promise.resolve().then(()=>hashLookup(artifact.sha256)).catch(()=>({status:'unavailable',message:'استعلام MalwareBazaar کامل نشد؛ نبودن هش در پایگاه تأیید نمی‌شود.'}));
      result.artifact=artifact;result.sha256=artifact.sha256;result.size=artifact.size;result.format=artifact.format;result.fileReputation=intel;
      result.status=knownUrlThreat||intel.status==='listed'?'danger':artifact.findings.length?'warning':artifact.status==='complete'?'limited':'unavailable';
      result.detail=artifact.status==='needs_password'?'آرشیو رمز دارد؛ برای تحلیل محتوا، فایل و رمز را از قسمت آپلود ارسال کنید.':artifact.details.join(' ');
      Object.assign(result,await routeFile(response.bytes,{name:result.name,artifact,intel,behaviorConsent,cloudBudget,onEvent},{behavior}));
      if(mode==='ultra'&&result.behavior.status!=='done'&&!['danger','warning'].includes(result.status))result.status='unavailable';
    }
    return conciseResult(result);
  }catch(error){
    if(Number.isSafeInteger(error.bytesRead))result.bytesRead=Math.max(result.bytesRead||0,error.bytesRead);
    result.reputation=await intelPromise;
    if(error.remoteStatus===401||error.remoteStatus===403)result.accessRequirement='requires_access';
    else if(error.remoteStatus===402)result.accessRequirement='requires_payment';
    const knownThreat=[result.reputation.status,result.finalReputation?.status,result.fileReputation?.status].includes('listed');
    result.failureStatus=error.status===400?'blocked':result.accessRequirement||'unavailable';
    result.status=knownThreat?'danger':result.failureStatus;
    const failure=error instanceof ScanError?error.message:'دریافت یا تحلیل این مقصد کامل نشد؛ امنیت تأیید نمی‌شود.';
    const threatEvidence=[result.reputation,result.finalReputation,result.fileReputation].filter(intel=>intel?.status==='listed').map(intel=>intel.message);
    result.detail=[...threatEvidence,failure].join(' ');
    return result;
  }
}

export async function stepScanJob({id,token}={}, {codec=jobTokens,inspect=inspectJobTarget,onEvent=()=>{},signal,now=Date.now}={}){
  const state=codec.read(token,id).result;delete state.scanToken;
  if(state.kind!=='scan-job'||!Array.isArray(state.targets)||!Number.isInteger(state.next))throw new ScanError('شناسهٔ صف معتبر نیست.',400);
  if(now()-new Date(state.createdAt).getTime()>30*60*1000)throw new ScanError('زمان صف تمام شده است؛ دوباره بررسی کنید.',404);
  const emit=event=>{const value={seq:(state.events.at(-1)?.seq||0)+1,at:new Date(now()).toISOString(),...event};state.events.push(value);if(state.events.length>160)state.events.shift();onEvent(value);};
  const end=Math.min(state.next+(state.mode==='ultra'||state.behaviorConsent===true?1:4),state.targets.length);const started=now();const first=state.next;
  for(;state.next<end;state.next++){
    // Leave room within the 180-second function budget for a destination's
    // public fetch, final-URL lookup, bounded parser and hash intelligence.
    if(state.next>first&&now()-started>85000)break;
    if(signal?.aborted)throw new ScanError('بررسی لغو شد؛ از آخرین مرحلهٔ ذخیره‌شده می‌توانید ادامه دهید.',409);
    const target=state.targets[state.next];emit({phase:'item_started',message:`بررسی مقصد ${state.next+1} از ${state.targets.length}`,targetId:target.id});
    let result;
    if(state.bytesRead>=MAX_TOTAL_BYTES)result={...target,status:'budget_exceeded',detail:'سقف مجموع دریافت ۹۶ مگابایت رسیده است؛ این مقصد بررسی نشده است.'};
    else result=await inspect(target,{signal,mode:state.mode,behaviorConsent:state.behaviorConsent===true,cloudBudget:2-(state.cloudAttempts||0),maxBytes:MAX_TOTAL_BYTES-state.bytesRead,onEvent:event=>emit({...event,targetId:target.id})});
    state.cloudAttempts=(state.cloudAttempts||0)+(result.behavior?.attempted===true?1:0);
    state.bytesRead+=result.bytesRead||0;delete result.bytesRead;
    if(state.mode==='ultra'&&!result.behavior)result.behavior={status:'unavailable',executed:false,reason:'برای این مقصد اجرای رفتاری ابری مشاهده نشده است؛ تحلیل ایستا جای اجرای واقعی نیست.'};
    target.status=result.status;if(result.kind==='file'&&result.name)target.name=result.name;const stored={...result};delete stored.url;delete stored.name;state.results.push(stored);emit({phase:'item_finished',message:`نتیجهٔ مقصد ${state.next+1} ثبت شد`,targetId:target.id,status:result.status});
  }
  state.done=state.next===state.targets.length;
  emit({phase:state.done?'completed':'batch_completed',message:state.done?'گزارش همهٔ مقصدهای صف آماده شد.':'این دسته بررسی شد؛ دستهٔ بعدی قابل ادامه است.'});
  return jobDto(state,codec);
}

export function scanJobReport(job){
  const report={...job.parent,advanced:true,scanMode:job.mode,createdAt:job.parent.createdAt,advancedAt:new Date().toISOString(),destinationResults:job.results,jobSummary:{total:job.targets.length,completed:job.results.length,omitted:job.omittedTargets,bytesRead:job.bytesRead,done:job.done},progressEvents:job.events,files:job.results.filter(item=>item.kind==='file').map(item=>({...item,extension:item.name.split('.').pop().slice(0,6).toUpperCase(),urlReputation:item.reputation,finalUrlReputation:item.finalReputation,reputation:item.fileReputation||{status:'not_queried',message:'هش کامل فایل دریافت نشد؛ استعلام MalwareBazaar انجام نشده است.'}}))};
  const receivedFiles=report.files.filter(file=>file.artifact&&file.sha256);
  report.discoveredFileCount=report.fileCount;
  report.fileCount=report.files.length;
  report.signals=report.signals.map(signal=>signal.code==='file_discovery'||signal.detail==='محتوای این فایل‌ها در بررسی اولیه دریافت نشده است.'?{
    ...signal,
    detail:`${receivedFiles.length} فایل دریافت و برای تحلیل محتوا بررسی شد؛ ${job.results.length} نتیجه از ${job.targets.length} مقصد ثبت شد. پوشش، خطا و محدودیت هر مورد در گزارش جداگانه آمده است.`
  }:signal);
  report.checks=report.checks.map(check=>{
    if(check.title!=='دریافت سرآیند لینک فایل')return check;
    const rootFile=receivedFiles.find(file=>(file.finalUrl||file.url)===report.finalUrl||file.url===report.url);
    return rootFile?{title:'دریافت محتوای فایل با رضایت',status:'done',detail:`${rootFile.size} بایت؛ هش کامل و نتیجهٔ تحلیل در جزئیات فایل ثبت شد.`}:check;
  });
  if(report.status==='danger'||job.results.some(result=>result.status==='danger'))report.status='danger';
  else if(job.results.some(result=>result.status==='warning'))report.status='warning';
  else if((job.mode==='ultra'&&job.results.some(result=>result.behavior?.status!=='done'))||job.omittedTargets||job.results.some(result=>['unavailable','blocked','requires_access','requires_payment','budget_exceeded'].includes(result.status)))report.status='unavailable';
  report.limitations=[...report.limitations,'گزارش صف فقط مقصدهای ثبت‌شدهٔ همین صفحه را پوشش می‌دهد؛ خزش بی‌پایان انجام نشده است.'];
  report.checks=[...report.checks,{title:'بررسی مقصدهای صف',status:job.done?'done':'unavailable',detail:`${job.results.length} نتیجه از ${job.targets.length} مقصد یکتا ثبت شد؛ ${job.bytesRead} بایت دریافت شد.`}];
  if(job.mode==='ultra')report.checks.push({title:'اجرای ابری مشاهده‌شده',status:job.results.every(result=>result.behavior?.status==='done')&&job.results.length?'done':'unavailable',detail:`${job.results.filter(result=>result.behavior?.executed).length} اجرای واقعی ثبت شد؛ بقیهٔ موارد از نظر رفتار تأیید نمی‌شوند.`});
  if(report.linkInventory){report.linkInventory={...report.linkInventory,status:'checked-targets',links:report.linkInventory.links.map(link=>{const result=job.results.find(result=>result.url===link.url);return result?{...link,status:result.status}:link;})};}
  delete report.scanToken;
  return report;
}
