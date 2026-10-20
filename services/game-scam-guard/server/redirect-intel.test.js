import test from 'node:test';
import assert from 'node:assert/strict';
import {scanSite} from './scanner.js';
import {inspectJobTarget} from './scan-jobs.js';
import {inspectRedirectReputation} from './redirect-intel.js';
import {lookupReputation,lookupUrl} from './threat-intel.js';

const start='https://example.com/',middle='https://example.com/hop',end='https://example.com/final';
const unknown={status:'not_found',message:'Synthetic observation; no safety guarantee'};
const page={url:end,status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<title>Benign authored redirect fixture</title><p>Information</p>'),redirects:[{from:start,to:middle,status:302},{from:middle,to:end,status:302}]};
const target={id:'target',url:start,name:'Authored fixture',kind:'page'};
async function both(lookup,pageValue=page){
 const options={validate:async()=>{},transport:async()=>pageValue};
 return [await scanSite(start,{...options,lookup,preview:async()=>({status:'unavailable',detail:'Authored fixture has no snapshot'}),allowCloudPreview:true}),await inspectJobTarget(target,{...options,urlLookup:lookup})];
}
test('a listed intermediate URL makes both root and linked-page reports dangerous',async()=>{
 const calls=[];
 const reports=await both(async url=>{calls.push(url);return url===middle?{status:'listed',message:'Inert test-only threat observation'}:unknown;});
 for(const report of reports){
  assert.equal(report.status,'danger');assert.equal(report.reputation.status,'not_found');assert.equal(report.finalReputation.status,'not_found');
  assert.equal(report.urlReputations.length,3);assert.equal(report.urlReputations[1].url,middle);assert.equal(report.urlReputations[1].reputation.status,'listed');
  assert.ok((report.signals||report.findings).some(item=>item.rule==='urlhaus_report'));
 }
 assert.deepEqual(calls,[start,middle,end,start,middle,end]);
 assert.equal(reports[0].inspectionLayers.find(row=>row.id==='reputation').status,'finding');
 assert.equal(reports[0].preview.status,'skipped');
});
test('intermediate lookup failure stays incomplete for both paths, without a false threat claim',async()=>{
 for(const report of await both(async url=>{if(url===middle)throw new Error('Synthetic outage');return unknown;})){
  assert.equal(report.status,'unavailable');assert.equal(report.urlReputations[1].reputation.status,'unavailable');
  assert.equal((report.signals||report.findings).some(item=>item.level==='danger'),false);
  if(report.checks)assert.equal(report.checks.find(item=>item.title==='استعلام منابع تهدید').status,'unavailable');
 }
});
test('a source failure inside an otherwise successful intermediate lookup remains a coverage gap',async()=>{
 for(const report of await both(async url=>url===middle?{...unknown,sources:[{provider:'urlhaus',...unknown},{provider:'openphish',status:'unavailable',message:'Synthetic outage'}]}:unknown))assert.equal(report.status,'unavailable');
});
test('listed intermediate address is retained when a linked page ends as a direct file',async()=>{
 const report=await inspectJobTarget(target,{validate:async()=>{},transport:async()=>({...page,headers:{'content-type':'application/octet-stream'},bytes:Buffer.alloc(0)}),urlLookup:async url=>url===middle?{status:'listed',message:'Synthetic report'}:unknown});
 assert.equal(report.status,'danger');assert.equal(report.kind,'file');assert.equal(report.urlReputations[1].reputation.status,'listed');
});
test('four redirects allow exactly five distinct URLs; duplicates and fragments share observations',async()=>{
 const urls=Array.from({length:5},(_,i)=>`https://example.com/${i}`),calls=[];
 const response={url:urls[4],redirects:urls.slice(1).map((url,i)=>({from:urls[i],to:url,status:302}))};
 const result=await inspectRedirectReputation(urls[0],response,unknown,{lookup:async url=>{calls.push(url);return unknown;}});
 assert.equal(result.urlReputations.length,5);assert.deepEqual(calls,urls.slice(1));
 calls.length=0;
 const duplicate=await inspectRedirectReputation(start,{url:start+'#end',redirects:[{from:start+'#first',to:middle,status:302},{from:middle,to:start+'#end',status:302}]},unknown,{lookup:async url=>{calls.push(url);return unknown;}});
 assert.deepEqual(calls,[middle]);assert.equal(duplicate.urlReputations.length,2);assert.deepEqual(duplicate.finalReputation,unknown);
 await assert.rejects(inspectRedirectReputation(start,{url:end,redirects:Array(5).fill({from:start,to:end})},unknown,{lookup:async()=>{throw new Error('Over-limit URLs must not be submitted');}}),/limit/);
});
test('a fragment cannot conceal an exact threat URL and provider requests remain time-bounded',async()=>{
 const calls=[];const listed={status:'listed',message:'Synthetic exact URL report'};
 const result=await lookupReputation(middle+'#ignored',{urlhaus:async url=>{calls.push(url);return listed;},phishing:async url=>{calls.push(url);return {status:'unconfigured',message:'Disabled'};}});
 assert.deepEqual(calls,[middle,middle]);assert.equal(result.status,'listed');
 await lookupUrl(start,{authKeyProvider:()=> 'synthetic-test-key',transport:async(url,options)=>{
  assert.equal(options.totalTimeout,10000);assert.equal(options.timeout,7000);assert.equal(options.noRedirect,true);
  return {status:200,bytes:Buffer.from('{"query_status":"no_results"}')};
 }});
});
