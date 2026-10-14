import test from 'node:test';
import assert from 'node:assert/strict';
import {routeFile} from './file-routing.js';
import {scanUploadedFile} from './uploads.js';
import {inspectJobTarget,startScanJob,stepScanJob} from './scan-jobs.js';
import {createReportTokens} from './report-token.js';
const bytes=Buffer.from('print("harmless routing fixture")');
const artifact={sha256:'a'.repeat(64),size:bytes.length,format:'Text / script',status:'complete',findings:[],details:['Static fixture only']};
const observed={status:'done',attempted:true,executed:true,teardownConfirmed:true,reason:'Synthetic behavior fixture, no sample ran'};

test('only a negative hash lookup with separate consent permits the cloud adapter',async()=>{
  let calls=0;const behavior=async()=>{calls++;return observed;};
  for(const status of ['listed','unconfigured','auth_error','unavailable','not_queried']){
    const result=await routeFile(bytes,{name:'fixture.py',artifact,intel:{status},behaviorConsent:true},{behavior});
    assert.equal(result.behavior.executed,false);assert.equal(result.routing.fallback,true);
  }
  assert.equal(calls,0);
  const refused=await routeFile(bytes,{name:'fixture.py',artifact,intel:{status:'not_found'}},{behavior});
  assert.equal(refused.routing.code,'consent_required');assert.equal(calls,0);
  const result=await routeFile(bytes,{name:'fixture.py',artifact,intel:{status:'not_found'},behaviorConsent:true},{behavior});
  assert.equal(calls,1);assert.equal(result.routing.code,'cloud_observed');assert.equal(result.routing.fallback,false);
});
test('missing, failing or exhausted cloud service retains explicit static fallback',async()=>{
  const input={name:'fixture.py',artifact,intel:{status:'not_found'},behaviorConsent:true};
  const result=await routeFile(bytes,input,{behavior:async()=>{throw new Error('Fixture quota denied');}});
  assert.equal(result.routing.code,'static_fallback');assert.equal(result.behavior.executed,false);
  let calls=0;const exhausted=await routeFile(bytes,{...input,cloudBudget:0},{behavior:async()=>{calls++;}});
  assert.equal(exhausted.routing.code,'cloud_budget');assert.equal(calls,0);
});
test('both uploaded and received advanced files use negative-only routing, without losing lookup errors',async()=>{
  let calls=0;const behavior=async()=>{calls++;return observed;};
  const lookup=async()=>({status:'not_found',message:'Fixture not found'});
  const upload={name:'fixture.py',bytes,mode:'advanced',consent:'true',behaviorConsent:true};
  const uploaded=await scanUploadedFile(upload,{analyze:async()=>artifact,lookup,behavior});
  assert.equal(uploaded.files[0].routing.code,'cloud_observed');assert.equal(calls,1);
  const target={id:'fixture',name:'fixture.py',url:'https://example.com/fixture.py',kind:'file'};
  const options={validate:async()=>{},urlLookup:lookup,hashLookup:lookup,analyze:async()=>artifact,behavior,behaviorConsent:true,transport:async()=>({bytes,url:target.url,headers:{'content-type':'text/plain'}})};
  const received=await inspectJobTarget(target,options);assert.equal(received.behavior.executed,true);assert.equal(calls,2);
  const failed=await scanUploadedFile(upload,{analyze:async()=>artifact,lookup:async()=>{throw new Error('Fixture upstream failed');},behavior});
  assert.equal(failed.files[0].reputation.status,'unavailable');assert.equal(failed.files[0].routing.code,'lookup_unavailable');assert.equal(calls,2);assert.equal(failed.files[0].sha256,artifact.sha256);
});
test('signed continuation retains execution consent and caps cloud attempts across batches',async()=>{
  const codec=createReportTokens({secret:'fixture routing key not a real secret 2026',maxBytes:1024*1024});
  const report={files:Array.from({length:4},(_,i)=>({id:String(i),name:`${i}.py`,url:`https://example.com/${i}.py`})),fileCount:4,linkCount:0};
  let job=startScanJob({mode:'ultra',consent:true,behaviorConsent:true},{codec,readReport:()=>report});
  let attempts=0;
  const inspect=async(target,options)=>{
    const routed=await routeFile(bytes,{...options,name:target.name,artifact,intel:{status:'not_found'}},{behavior:async()=>{attempts++;return observed;}});
    return {...target,status:'limited',...routed};
  };
  while(!job.done)job=await stepScanJob({id:job.id,token:job.token},{codec,inspect});
  assert.equal(attempts,2);assert.equal(job.cloudAttempts,2);assert.equal(job.results[3].routing.code,'cloud_budget');
  const old=startScanJob({consent:true},{codec,readReport:()=>report});assert.equal(old.behaviorConsent,false);
});

test('execution-authorized advanced jobs use one-target batches to fit worst-case VM latency',async()=>{
  let clock=Date.now();const codec=createReportTokens({secret:'fixture cloud time key not real credential',now:()=>clock,maxBytes:1024*1024});
  const report={files:Array.from({length:4},(_,i)=>({id:String(i),name:`${i}.py`,url:`https://example.com/${i}.py`})),fileCount:4,linkCount:0};
  const first=startScanJob({mode:'advanced',consent:true,behaviorConsent:true},{codec,readReport:()=>report,now:()=>clock});
  let calls=0;const next=await stepScanJob({id:first.id,token:first.token},{codec,now:()=>clock,inspect:async target=>{calls++;clock+=calls===1?70000:110000;return {...target,status:'limited',behavior:observed};}});
  assert.equal(calls,1);assert.equal(next.next,1);assert.equal(next.done,false);
});
