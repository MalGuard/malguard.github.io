import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectJobTarget,startScanJob,stepScanJob,scanJobReport} from './scan-jobs.js';
import {parsePage} from './scanner.js';
import {createReportTokens} from './report-token.js';
import {analyzeArtifactRaw} from './artifact-engine.js';
import {receivedFilename} from './received-filename.js';

const bytes=Buffer.from('print("harmless filename fixture")');
const lookup=async()=>({status:'not_found',message:'Synthetic negative lookup'});
const target={id:'file',url:'https://example.com/download',name:'Download now',kind:'page'};
const observed={status:'done',executed:true,attempted:true,teardownConfirmed:true,reason:'Synthetic behavior; no execution'};
async function inspect({url=target.url,disposition,name=target.name,behaviorConsent=false}={}){
  let called;
  const result=await inspectJobTarget({...target,name},{validate:async()=>{},urlLookup:lookup,hashLookup:lookup,analyze:analyzeArtifactRaw,behaviorConsent,
    transport:async()=>({bytes,url,headers:{'content-type':'application/octet-stream',...(disposition?{'content-disposition':disposition}:{})}}),
    behavior:async(bytes,meta)=>{called=meta;return observed;}});
  return {result,called};
}

test('observed attachment filename drives supported analysis instead of the link label',async()=>{
  const {result,called}=await inspect({disposition:'attachment; filename="fixture.py"',behaviorConsent:true});
  assert.equal(result.name,'fixture.py');assert.equal(result.format,'Text / script');assert.equal(result.routing.code,'cloud_observed');assert.equal(called.name,'fixture.py');
});
test('public final URL supplies actual script basename when attachment metadata is absent',async()=>{
  const {result}=await inspect({url:'https://example.com/files/fixture.py'});
  assert.equal(result.name,'fixture.py');assert.equal(result.format,'Text / script');assert.equal(result.routing.code,'consent_required');
});
test('all adapter-compatible script/ELF and GTA ASI anchor links are retained as file candidates',()=>{
  const names=['fixture.js','fixture.mjs','fixture.cjs','fixture.py','fixture.sh','fixture.elf','mod.asi','mod.lua'];
  const page=parsePage(Buffer.from('<title>Fixture</title>'+names.map(name=>`<a href="/${name}">Download</a>`).join('')),'https://example.com/');
  assert.deepEqual(page.files.map(file=>file.name),names);assert.equal(page.fileCount,names.length);
});

test('UTF-8 attachment names are decoded while traversal, controls and malformed encodings are rejected',()=>{
  const response=header=>({url:'https://example.com/fixture.py',headers:{'content-disposition':header}});
  assert.equal(receivedFilename(response("attachment; filename=fallback.txt; filename*=UTF-8'fa'%D9%81%D8%A7%DB%8C%D9%84.py")),'فایل.py');
  for(const value of ['attachment; filename="../outside.js"','attachment; filename="bad\\name.js"',"attachment; filename*=UTF-8''%00fake.js","attachment; filename*=UTF-8''%E0%A4%A",'attachment; filename="'+('x'.repeat(181))+'.js"'])assert.equal(receivedFilename(response(value)),'fixture.py');
});

test('observed names survive signed batches and resume without acquiring execution consent',async()=>{
  const codec=createReportTokens({secret:'fixture received filename key not real credential',maxBytes:1024*1024});
  const report={files:[target],fileCount:1,linkCount:0};
  let job=startScanJob({consent:true},{codec,readReport:()=>report});
  job=await stepScanJob({id:job.id,token:job.token},{codec,inspect:async()=> (await inspect({disposition:'attachment; filename="fixture.py"'})).result});
  assert.equal(job.targets[0].name,'fixture.py');assert.equal(job.results[0].name,'fixture.py');
  const stored=codec.read(job.token,job.id).result;assert.equal(stored.targets[0].name,'fixture.py');assert.equal(stored.behaviorConsent,false);assert.equal(stored.results[0].behavior.executed,false);
});

test('existing installer/archive candidates keep their filename across generic redirect handlers',()=>{
  for(const name of ['setup.msi','mod.7z','mod.rar','package.jar','bundle.tar.gz'])assert.equal(receivedFilename({url:'https://example.com/download',headers:{}},name),name);
});

test('final file count includes a generic link whose response is actually a file',()=>{
  const parent=parsePage(Buffer.from('<title>Fixture</title><a href="/script.py">Python</a><a href="/download">Download</a>'),'https://example.com/');
  parent.limitations=[];parent.checks=[];parent.status='limited';parent.url=parent.finalUrl='https://example.com/';
  assert.equal(parent.fileCount,1);
  const job={parent,mode:'advanced',targets:[{id:'1'},{id:'2'}],results:[{id:'1',kind:'file',name:'script.py',status:'limited'},{id:'2',kind:'file',name:'observed.py',status:'limited'}],omittedTargets:0,bytesRead:32,done:true,events:[]};
  const report=scanJobReport(job);assert.equal(report.files.length,2);assert.equal(report.fileCount,2);
});
