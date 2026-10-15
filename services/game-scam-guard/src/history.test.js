import test from 'node:test';
import assert from 'node:assert/strict';
import { readHistory } from './history.js';

const valid = {
  id: 'fixture-report', domain: 'example.com', title: 'Example Domain',
  url: 'https://example.com/', finalUrl: 'https://example.com/',
  createdAt: '2026-10-11T12:00:00.000Z', status: 'limited', advanced: false,
  description: '', excerpt: 'Example text', contentType: 'text/html',
  linkCount: 1, fileCount: 1, headings: ['Example Domain'], limitations: ['Passive scan'],
  files: [{id:'file', name:'dummy.pdf', extension:'PDF', url:'https://example.com/dummy.pdf', status:'unscanned'}],
  checks: [{title:'Fetched',status:'done',detail:'HTTP 200'}], signals: [], redirects: [],
  reputation: {status:'unconfigured',message:'Not configured'},
  preview: {status:'available',detail:'Passive browser preview'},
};

test('history preserves complete reports while dropping old or corrupted records', () => {
  const old = {domain:'example.com',title:'Old report',files:[],checks:[]};
  const broken = [old, {...valid,createdAt:'invalid'}, {...valid,headings:null}, {...valid,checks:[null]}, {...valid,signals:[{title:{}}]}, {...valid,files:[{...valid.files[0],url:'bad'}]}, {...valid,files:[{...valid.files[0],extension:{}}]}, {...valid,preview:{status:'available',detail:{}}}];
  assert.deepEqual(readHistory(JSON.stringify([...broken,valid])),[valid]);
});

test('history recovers from invalid storage and limits valid records to thirty', () => {
  for (const raw of ['{broken','null','{}','[null,2,"old"]']) assert.deepEqual(readHistory(raw),[]);
  assert.equal(readHistory(JSON.stringify(Array.from({length:40},(_,index)=>({...valid,id:String(index)})))).length,30);
});

test('incomplete reports reopen honestly while malformed fetch metadata is rejected',()=> {
  const incomplete={...valid,status:'unavailable',files:[],pageFetch:{status:'unavailable',reason:'timeout',detail:'Content was not received',attempts:2},inputAdjusted:true};
  const damaged=[{...incomplete,pageFetch:{status:'done',attempts:'two'}},{...incomplete,inputAdjusted:'yes'},{...incomplete,pageFetch:{status:'invalid',attempts:2}}];
  assert.deepEqual(readHistory(JSON.stringify([...damaged,incomplete])),[incomplete]);
});

test('new link inventory survives history while corrupt link rows and false completion claims are rejected',()=>{
  const inventory={total:1,retained:1,omitted:0,status:'discovered-only',links:[{position:1,label:'Mod',url:'https://example.com/mod.zip',kind:'file',status:'unscanned'}]};
  const report={...valid,linkInventory:inventory};
  assert.deepEqual(readHistory(JSON.stringify([report])),[report]);
  for(const damaged of [{...inventory,total:2},{...inventory,links:[{...inventory.links[0],url:'javascript:alert(1)'}]},{...inventory,links:[{...inventory.links[0],status:'safe'}]}])assert.deepEqual(readHistory(JSON.stringify([{...valid,linkInventory:damaged}])),[]);
});

test('file and behavior evidence is validated before reopening uploads or queue reports',()=>{
  const analysis={engine:'Fixture',version:'1',status:'complete',format:'Text / script',size:5,sha256:'a'.repeat(64),executed:false,findings:[]};
  const item={...valid,source:'upload',files:[{...valid.files[0],artifact:analysis,behavior:{status:'unavailable',executed:false,reason:'Not executed'}}]};
  assert.deepEqual(readHistory(JSON.stringify([item])),[item]);
  for(const artifact of [{...analysis,findings:[null]},{...analysis,archive:{inspected:1,listed:1,entries:[null]}}])assert.deepEqual(readHistory(JSON.stringify([{...item,files:[{...item.files[0],artifact}]}])),[]);
  assert.deepEqual(readHistory(JSON.stringify([{...item,files:[{...item.files[0],behavior:{status:'done',executed:true,reason:'Fixture',createdFiles:{}}}]}])),[]);
});

test('history does not exceed its metadata byte budget',()=>{
  const large={...valid,excerpt:'x'.repeat(1024*1024)};assert.equal(readHistory(JSON.stringify([large,{...large,id:'second'}])).length,1);
});


test('queue history requires the summary rendered by the UI and valid provider evidence',()=>{
  const row={id:'queued-file',url:'https://example.com/a.zip',name:'a.zip',kind:'file',status:'danger',reputation:{status:'listed',message:'URLhaus fixture known threat'}};
  const item={...valid,advanced:true,destinationResults:[row],jobSummary:{total:1,completed:1,omitted:0,bytesRead:0,done:true},files:[{...valid.files[0],urlReputation:row.reputation,reputation:{status:'not_queried',message:'MalwareBazaar fixture query not performed'}}]};
  assert.deepEqual(readHistory(JSON.stringify([item])),[item]);
  const noSummary={...item};delete noSummary.jobSummary;
  const damaged=[noSummary,{...item,destinationResults:[{...row,finalUrl:{}}]},{...item,destinationResults:[{...row,finalReputation:{status:'listed',message:{}}}]},{...item,files:[{...item.files[0],finalUrlReputation:{status:'listed',message:{}}}]},{...item,destinationResults:[{...row,reputation:{status:'listed',message:{}}}]},{...item,files:[{...item.files[0],urlReputation:{status:'listed',message:{}}}]}];
  for(const report of damaged)assert.deepEqual(readHistory(JSON.stringify([report])),[]);
});


test('corrupt rendered routing and layer evidence are rejected before history reopen',()=>{
  const analysis={engine:'Fixture',version:'1.1',status:'complete',format:'Text / script',size:5,sha256:'a'.repeat(64),executed:false,findings:[],layers:[{id:'identity',title:'Hash',status:'done',detail:'Full file'}],observedUrls:['https://example.com/']};
  const routing={code:'static_fallback',fallback:true,detail:'Fixture unavailable cloud'};
  const report={...valid,files:[{...valid.files[0],artifact:analysis,routing}]};
  assert.deepEqual(readHistory(JSON.stringify([report])),[report]);
  for(const file of [{...report.files[0],routing:{...routing,detail:{}}},{...report.files[0],artifact:{...analysis,layers:[null]}},{...report.files[0],artifact:{...analysis,observedUrls:[{}]}}])assert.deepEqual(readHistory(JSON.stringify([{...report,files:[file]}])),[]);
});
