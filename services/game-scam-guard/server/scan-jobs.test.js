import test from 'node:test';
import assert from 'node:assert/strict';
import {ScanError} from './network.js';
import {createReportTokens} from './report-token.js';
import {startScanJob,stepScanJob,scanJobReport,inspectJobTarget} from './scan-jobs.js';

const base={id:'root',url:'https://example.com/',finalUrl:'https://example.com/',domain:'example.com',title:'Fixture',description:'',excerpt:'',contentType:'text/html',createdAt:new Date().toISOString(),status:'limited',advanced:false,files:[],fileCount:0,linkCount:54,headings:[],redirects:[],signals:[],checks:[],limitations:[],pageFetch:{status:'done',attempts:1},linkInventory:{total:54,retained:54,omitted:0,status:'discovered-only',links:Array.from({length:54},(_,i)=>({position:i+1,label:`Page ${i}`,url:`https://example.com/page-${i}`,kind:'page',status:'unscanned'}))}};
const codec=()=>createReportTokens({secret:'queue-fixture-shared-secret-32-characters',maxBytes:1024*1024});
const start=(report=base,mode='advanced',c=codec())=>({c,job:startScanJob({id:'root',token:'fixture',mode,consent:true},{codec:c,readReport:()=>report})});

test('download consent and server-observed report are required; arbitrary target lists are ignored',()=>{
  assert.throws(()=>startScanJob({consent:false}),{status:400});
  assert.throws(()=>start({...base,pageFetch:{status:'unavailable'}}),{status:409});
  const {job}=start();assert.equal(job.targets.length,54);assert.equal(job.targets[0].url,base.linkInventory.links[0].url);
});

test('54 destinations finish across signed batches with every result preserved and genuine events',async()=>{
  let {job,c}=start();let calls=0;const events=[];
  while(!job.done)job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>{calls++;return {...target,status:calls===3?'unavailable':'limited',detail:'Synthetic fixture result'};},onEvent:event=>events.push(event)});
  assert.equal(calls,54);assert.equal(job.results.length,54);assert.equal(job.next,54);
  assert.equal(events.filter(e=>e.phase==='item_started').length,54);assert.equal(events.filter(e=>e.phase==='item_finished').length,54);
  const report=scanJobReport(job);assert.equal(report.jobSummary.completed,54);assert.equal(report.destinationResults.length,54);assert.equal(report.status,'unavailable');assert.equal(report.linkInventory.links[2].status,'unavailable');
});

test('a saved batch continues on another codec instance and tampered capabilities do not inspect targets',async()=>{
  let {job,c}=start();job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'limited'})});assert.equal(job.next,4);
  const other=codec();const continued=await stepScanJob({id:job.id,token:job.token},{codec:other,inspect:async target=>({...target,status:'limited'})});assert.equal(continued.next,8);
  const bytes=Buffer.from(job.token.slice(3),'base64url');bytes[28]^=1;let calls=0;
  await assert.rejects(stepScanJob({id:job.id,token:'r1.'+bytes.toString('base64url')},{codec:c,inspect:async()=>{calls++;}}),{status:404});assert.equal(calls,0);
});

test('private destination validation happens before page fetch or threat-provider lookup',async()=>{
  let calls=0;const report=await inspectJobTarget({id:'private',url:'http://169.254.169.254/latest/',kind:'page',name:'Private'},{transport:async()=>{calls++;},urlLookup:async()=>{calls++;}});
  assert.equal(report.status,'blocked');assert.equal(calls,0);
});

test('known-threat parent is retained while passive advanced analysis can still report destinations',async()=>{
  let {job,c}=start({...base,status:'danger'});while(!job.done)job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'limited'})});
  assert.equal(scanJobReport(job).status,'danger');
});

test('ultra requests use one-target batches and explicitly expose missing execution evidence',async()=>{
  let {job,c}=start(base,'ultra');job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'limited'})});
  assert.equal(job.next,1);assert.equal(job.results[0].behavior.executed,false);assert.equal(scanJobReport(job).status,'unavailable');
});


test('advanced report replaces initial file-discovery wording without claiming failed downloads were inspected',async()=>{
  const file={id:'observed',url:'https://example.com/a.js',name:'a.js'};
  const report={...base,url:file.url,finalUrl:file.url,files:[file],fileCount:1,linkCount:0,linkInventory:undefined,signals:[{code:'file_discovery',level:'info',title:'1 لینک فایل پیدا شد',detail:'محتوای این فایل‌ها در بررسی اولیه دریافت نشده است.'},{level:'warning',title:'Original caution',detail:'Keep this evidence'}],checks:[{title:'دریافت سرآیند لینک فایل',status:'done',detail:'Waiting for consent'}]};
  let {job,c}=start(report);job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,kind:'file',status:'limited',sha256:'a'.repeat(64),size:32,artifact:{size:32}})});
  const completed=scanJobReport(job);assert.match(completed.signals[0].detail,/1 فایل دریافت/);assert.equal(completed.signals[1].detail,'Keep this evidence');assert.equal(completed.checks[0].title,'دریافت محتوای فایل با رضایت');
  ({job,c}=start(report));job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'unavailable'})});
  const failed=scanJobReport(job);assert.match(failed.signals[0].detail,/0 فایل دریافت/);assert.equal(failed.status,'unavailable');assert.equal(failed.checks[0].title,'دریافت سرآیند لینک فایل');
});


test('known URL threat survives inaccessible content while access failures remain explicit',async()=>{
  const target={id:'listed-target',url:'https://example.com/locked.js',kind:'file',name:'locked.js'};
  for(const remoteStatus of [401,403,402])for(const listed of [true,false]){
    const error=Object.assign(new ScanError(`HTTP ${remoteStatus}; fixture content unavailable`),{remoteStatus,bytesRead:17});
    const result=await inspectJobTarget(target,{validate:async()=>{},urlLookup:async()=>({status:listed?'listed':'not_found',message:listed?'Fixture known threat':'No known fixture threat'}),transport:async()=>{throw error;}});
    assert.equal(result.status,listed?'danger':remoteStatus===402?'requires_payment':'requires_access');
    assert.equal(result.accessRequirement,remoteStatus===402?'requires_payment':'requires_access');assert.equal(result.failureStatus,result.accessRequirement);assert.equal(result.bytesRead,17);assert.match(result.detail,new RegExp(String(remoteStatus)));assert.equal(result.artifact,undefined);
    let {job,c}=start({...base,files:[target],fileCount:1,linkCount:0,linkInventory:undefined});
    job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async()=>result});assert.equal(scanJobReport(job).status,listed?'danger':'unavailable');
  }
  const blocked=await inspectJobTarget(target,{validate:async()=>{},urlLookup:async()=>({status:'listed',message:'Fixture public URL known threat'}),transport:async()=>{throw new ScanError('Fixture private redirect blocked',400);}});
  assert.equal(blocked.status,'danger');assert.equal(blocked.failureStatus,'blocked');assert.equal(blocked.artifact,undefined);assert.match(blocked.detail,/known threat.*redirect blocked/);
});

test('a known MalwareBazaar threat skips execution and preserves its static evidence',async()=>{
  const sha256='b'.repeat(64),bytes=Buffer.from('harmless fixture');
  const result=await inspectJobTarget({id:'hash-listed',url:'https://example.com/a.js',name:'a.js',kind:'file'},
    {mode:'ultra',validate:async()=>{},urlLookup:async()=>({status:'not_found',message:'Fixture URL not listed'}),transport:async()=>({bytes,url:'https://example.com/a.js',headers:{'content-type':'text/javascript'}}),
    analyze:async()=>({sha256,size:bytes.length,format:'Text / script',status:'complete',findings:[],details:['Harmless static fixture']}),hashLookup:async()=>({status:'listed',message:'Fixture hash listed'}),behavior:async()=>{throw new Error('Fixture unavailable behavior service');}});
  assert.equal(result.status,'danger');assert.equal(result.fileReputation.status,'listed');assert.equal(result.sha256,sha256);assert.equal(result.routing.code,'known_threat');assert.equal(result.behavior.attempted,false);
});


test('file reports never label URLhaus evidence as a completed MalwareBazaar query',async()=>{
  const target={id:'provider-separation',url:'https://example.com/mod.zip',name:'mod.zip',kind:'file'};
  for(const hashQueried of [true,false]){
    let {job,c}=start({...base,files:[target],fileCount:1,linkCount:0,linkInventory:undefined});
    job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async()=>({...target,status:'danger',reputation:{status:'listed',message:'URLhaus fixture known threat'},...(hashQueried?{fileReputation:{status:'not_found',message:'MalwareBazaar fixture hash not found'}}:{})})});
    const report=scanJobReport(job),file=report.files[0];assert.equal(file.urlReputation.status,'listed');assert.equal(report.destinationResults[0].reputation.status,'listed');
    assert.equal(file.reputation.status,hashQueried?'not_found':'not_queried');assert.match(file.reputation.message,/MalwareBazaar/);assert.ok(!file.reputation.message.includes('URLhaus fixture'));
  }
});


test('advanced targets query the actual public redirect destination and preserve either URL threat',async()=>{
  const target={id:'redirect-target',url:'https://example.com/start.js',kind:'file',name:'start.js'},finalUrl='https://example.net/final.js';
  for(const firstListed of [false,true])for(const mime of ['text/javascript','text/html']){
    const lookups=[];
    const result=await inspectJobTarget(target,{validate:async()=>{},transport:async()=>({bytes:Buffer.from(mime==='text/html'?'<title>Public fixture</title><body>Harmless fixture</body>':'console.log("harmless fixture")'),url:finalUrl,headers:{'content-type':mime}}),
      urlLookup:async url=>{lookups.push(url);return {status:(url===target.url?firstListed:!firstListed)?'listed':'not_found',message:`Fixture URLhaus ${url}`};},hashLookup:async()=>({status:'not_found',message:'Fixture hash not found'})});
    assert.deepEqual(lookups,[target.url,finalUrl]);assert.equal(result.status,'danger');assert.equal(result.finalReputation.status,firstListed?'not_found':'listed');
    let {job,c}=start({...base,files:[target],fileCount:1,linkCount:0,linkInventory:undefined});job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async()=>result});
    const report=scanJobReport(job);assert.equal(report.status,'danger');assert.equal(report.destinationResults[0].finalReputation.status,result.finalReputation.status);if(mime!=='text/html')assert.equal(report.files[0].finalUrlReputation.status,result.finalReputation.status);
  }
  const lookups=[];
  const plain=await inspectJobTarget(target,{validate:async()=>{},transport:async()=>({bytes:Buffer.from('console.log("harmless fixture")'),url:target.url,headers:{'content-type':'text/javascript'}}),urlLookup:async url=>{lookups.push(url);return {status:'not_found',message:'Fixture not listed'};},hashLookup:async()=>({status:'not_found',message:'Fixture hash not listed'})});
  assert.deepEqual(lookups,[target.url]);assert.equal(plain.finalReputation,undefined);
  const incomplete=await inspectJobTarget(target,{validate:async()=>{},transport:async()=>({bytes:Buffer.from('console.log("harmless fixture")'),url:finalUrl,headers:{'content-type':'text/javascript'}}),urlLookup:async url=>{if(url===finalUrl)throw new Error('Fixture final lookup error');return {status:'not_found',message:'Fixture initial not listed'};},hashLookup:async()=>({status:'not_found',message:'Fixture hash not listed'})});
  assert.equal(incomplete.finalReputation.status,'unavailable');assert.equal(incomplete.artifact.executed,false);assert.equal(incomplete.status,'limited');
});

test('slow advanced batches yield early enough to leave time for final-URL intelligence',async()=>{
  let time=Date.now();let {job,c}=start();let calls=0;
  job=await stepScanJob({id:job.id,token:job.token},{codec:c,now:()=>time,inspect:async target=>{calls++;time+=43000;return {...target,status:'limited'};}});
  assert.equal(calls,2);assert.equal(job.next,2);assert.equal(job.done,false);assert.equal(job.results.length,2);
});
