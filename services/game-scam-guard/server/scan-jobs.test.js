import test from 'node:test';
import assert from 'node:assert/strict';
import {ScanError} from './network.js';
import {createReportTokens} from './report-token.js';
import {startScanJob,stepScanJob,scanJobReport,inspectJobTarget,prepareJobPreview} from './scan-jobs.js';
import {scanSite} from './scanner.js';

const pages=Array.from({length:6},(_,i)=>({position:i+1,label:`Page ${i}`,url:`https://example.com/page-${i}`,kind:'page',status:'unscanned'}));
const downloads=[{position:7,label:'Installer',url:'https://example.com/game.zip',kind:'file',status:'unscanned'}];
const base={id:'root',url:'https://example.com/',finalUrl:'https://example.com/',domain:'example.com',title:'Fixture',description:'',excerpt:'',contentType:'text/html',createdAt:new Date().toISOString(),status:'limited',advanced:false,files:[],fileCount:0,linkCount:7,headings:[],redirects:[],signals:[],checks:[],limitations:[],pageFetch:{status:'done',attempts:1},linkInventory:{total:7,retained:7,omitted:0,status:'discovered-only',links:[...pages,...downloads]}};
const codec=()=>createReportTokens({secret:'queue-fixture-shared-secret-32-characters',maxBytes:1024*1024});
const start=(report=base,c=codec())=>({c,job:startScanJob({id:'root',token:'fixture',mode:'advanced',consent:true},{codec:c,readReport:()=>report})});

test('website queue accepts only observed public page links and omits downloads',()=>{
  assert.throws(()=>startScanJob({consent:false}),{status:400});
  assert.throws(()=>startScanJob({mode:'ultra',consent:true},{readReport:()=>base}),{status:400});
  const {job}=start();assert.equal(job.targets.length,6);assert.ok(job.targets.every(target=>target.kind==='page'));assert.equal(job.omittedTargets,0);assert.equal(job.excludedTargets,1);
});

test('bounded page queue persists across signed batches and preserves each result',async()=>{
  let {job,c}=start();let calls=0;
  while(!job.done)job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:++calls===3?'unavailable':'limited',detail:'Synthetic page result'})});
  assert.equal(calls,6);assert.equal(job.results.length,6);
  const report=scanJobReport(job);assert.equal(report.files.length,0);assert.equal(report.fileCount,0);assert.equal(report.status,'unavailable');assert.equal(report.destinationResults.length,6);
});

test('the capability continues on a different instance and rejects tampering',async()=>{
  let {job,c}=start();job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'limited'})});
  const other=codec();const continued=await stepScanJob({id:job.id,token:job.token},{codec:other,inspect:async target=>({...target,status:'limited'})});assert.equal(continued.next,6);
  const bytes=Buffer.from(job.token.slice(3),'base64url');bytes[28]^=1;await assert.rejects(stepScanJob({id:job.id,token:'r1.'+bytes.toString('base64url')},{codec:c,inspect:async()=>{}}),{status:404});
});

test('private destinations are blocked before fetch or intelligence lookup',async()=>{
  let calls=0;const result=await inspectJobTarget({id:'private',url:'http://169.254.169.254/latest/',kind:'page',name:'Private'},{transport:async()=>{calls++;},urlLookup:async()=>{calls++;}});
  assert.equal(result.status,'blocked');assert.equal(calls,0);
});

test('a linked destination that responds with a direct file is not retrieved, hashed, parsed, or executed',async()=>{
  const target={id:'file-response',url:'https://example.com/download',kind:'page',name:'Download'};let options;
  const result=await inspectJobTarget(target,{validate:async()=>{},urlLookup:async()=>({status:'not_found',message:'Fixture URL not listed'}),transport:async(_url,value)=>{options=value;return {bytes:Buffer.alloc(0),url:target.url,headers:{'content-type':'audio/mpeg'}};}});
  assert.equal(options.htmlOnly,true);assert.equal(result.kind,'file');assert.equal(result.status,'unavailable');assert.equal(result.artifact,undefined);assert.equal(result.behavior,undefined);assert.match(result.detail,/GTA Guard/);
});

test('reported URL threat survives inaccessible linked content',async()=>{
  const target={id:'listed',url:'https://example.com/locked',kind:'page',name:'Locked'};
  const error=Object.assign(new ScanError('HTTP 403; fixture content unavailable'),{remoteStatus:403,bytesRead:0});
  const result=await inspectJobTarget(target,{validate:async()=>{},urlLookup:async()=>({status:'listed',message:'Fixture URL threat'}),transport:async()=>{throw error;}});
  assert.equal(result.status,'danger');assert.equal(result.accessRequirement,'requires_access');
});


test('excluded downloads do not degrade a clean page and original caution survives incomplete children',async()=>{
  let {job,c}=start();while(!job.done)job=await stepScanJob({id:job.id,token:job.token},{codec:c,inspect:async target=>({...target,status:'limited'})});
  const clean=scanJobReport(job);assert.equal(clean.status,'limited');assert.equal(clean.initialAssessment.status,'limited');assert.equal(clean.jobSummary.excluded,1);
  const partial=scanJobReport({...job,parent:{...base,status:'warning'},results:[...job.results,{id:'unreachable',status:'unavailable'}]});
  assert.equal(partial.status,'warning');assert.equal(partial.initialAssessment.status,'warning');assert.equal(partial.linkedAssessment.incomplete,1);
  const threat=scanJobReport({...job,results:[{id:'bad',status:'danger'}]});assert.equal(threat.status,'danger');assert.equal(threat.initialAssessment.status,'limited');assert.match(threat.linkedAssessment.reason,/threat evidence/);
});

test('advanced browser upgrade renders only the exact signed HTML and preserves the verdict',async()=>{
  const {createHash}=await import('node:crypto');const bytes=Buffer.from('<html>Original page</html>');
  const parent={...base,siteAnalysis:{htmlSha256:createHash('sha256').update(bytes).digest('hex')},preview:{status:'skipped',detail:'Not requested'}};
  const {job,c}=start(parent);let renders=0;
  const options={codec:c,transport:async()=>({url:parent.finalUrl,bytes}),preview:async()=>{renders++;return {status:'done',detail:'Fixture browser snapshot',image:'data:image/jpeg;base64,'+'A'.repeat(1500000)};}};
  const upgraded=await prepareJobPreview(job,options);assert.equal(upgraded.parent.preview.status,'done');assert.equal(upgraded.parent.status,parent.status);assert.equal(renders,1);assert.equal(c.read(upgraded.token,upgraded.id).result.parent.preview.image,undefined);
  const changed=await prepareJobPreview(job,{...options,transport:async()=>({url:parent.finalUrl,bytes:Buffer.from('Changed')})});assert.equal(changed.parent.preview.status,'unavailable');assert.match(changed.parent.preview.detail,/changed/);assert.equal(renders,1);
});

test('submitted and linked pages use the same redirect and threat assessment policy',async()=>{
  const requested='https://example.com/';
  const final='https://destination.example.com/';
  for(const listed of [false,true]){
    const response={url:final,status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<html><title>Owned parity fixture</title><body>Public page</body></html>'),redirects:[{from:requested,to:final,status:302}]};
    const lookup=async url=>({status:listed&&url===final?'listed':'not_found',message:'Authored threat-intelligence fixture'});
    const options={validate:async()=>{},transport:async()=>response};
    const original=await scanSite(requested,{...options,lookup});
    const linked=await inspectJobTarget({id:'parity',url:requested,name:'Page',kind:'page'},{...options,urlLookup:lookup});
    assert.equal(original.status,listed?'danger':'warning');
    assert.equal(linked.status,original.status);
    assert.deepEqual(linked.findings,original.signals);
    assert.ok(linked.findings.some(signal=>signal.rule==='cross_domain_redirect'));
    if(listed)assert.ok(linked.findings.some(signal=>signal.rule==='urlhaus_report'));
  }
});

test('streamed progress counts each processed target before a batch completes and resumes monotonically',async()=>{
  let {job,c}=start();const events=[];let inspected=0;
  const options={codec:c,onEvent:event=>events.push(event),inspect:async target=>({...target,status:++inspected===2?'unavailable':'limited'})};
  job=await stepScanJob({id:job.id,token:job.token},options);
  assert.deepEqual(events.filter(event=>event.phase==='item_finished').map(event=>event.completed),[1,2,3,4]);
  assert.ok(events.filter(event=>event.phase==='item_finished').every(event=>event.total===6));
  assert.equal(job.done,false);
  job=await stepScanJob({id:job.id,token:job.token},options);
  assert.equal(job.done,true);
  assert.deepEqual(events.filter(event=>event.phase==='item_finished').map(event=>event.completed),[1,2,3,4,5,6]);
  assert.deepEqual(events.filter(event=>event.phase==='item_started').map(event=>event.completed),[0,1,2,3,4,5]);
  assert.equal(events.filter(event=>event.phase==='item_finished')[1].status,'unavailable');
});
