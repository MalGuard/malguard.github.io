import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSitePage,scanSite} from './scanner.js';
import {normalizeUrl,ScanError} from './network.js';

const timeout=()=>new ScanError('fixture timeout',422,'request_timeout');
const page={status:200,headers:{'content-type':'text/html'},bytes:Buffer.from('<title>Recovered store</title><body><h1>Downloads</h1><a href="/mod.zip">Mod</a></body>'),url:'https://example.com/',redirects:[]};
const unknown={status:'not_found',message:'No known report; not a safety guarantee'};

test('copied edge artifacts are removed without rewriting encoded or interior path characters',()=> {
  assert.equal(normalizeUrl(' http://testphp.vulnweb.com/\uFFFC ').href,'http://testphp.vulnweb.com/');
  assert.equal(normalizeUrl('\u200B https://example.com/ \uFFFC').href,'https://example.com/');
  assert.equal(normalizeUrl('https://example.com/%EF%BF%BC').pathname,'/%EF%BF%BC');
  assert.equal(normalizeUrl('https://example.com/a\uFFFCb').pathname,'/a%EF%BF%BCb');
  assert.throws(()=>normalizeUrl('\uFFFC'),{status:400});
});

test('transient page timeout retries the same URL once and can recover',async()=> {
  let calls=0;const sent=[];
  const result=await fetchSitePage(new URL(page.url),{transport:async(url,options)=>{
    sent.push({url:url.href,options});if(++calls===1)throw timeout();return page;
  }});
  assert.equal(calls,2);assert.equal(result.attempts,2);
  assert.deepEqual(sent.map(request=>request.url),[page.url,page.url]);
  assert.ok(sent.every(request=>request.options.htmlOnly&&request.options.totalTimeout<=22000));
});

test('retry budget, private-address errors and TLS failures are never bypassed',async()=> {
  let calls=0;let clock=0;
  await assert.rejects(fetchSitePage(page.url,{now:()=>clock,transport:async()=>{calls++;clock=22000;throw timeout();}}),{code:'request_timeout'});
  assert.equal(calls,1);
  for(const error of [new ScanError('private',400),Object.assign(new Error('certificate expired'),{code:'CERT_HAS_EXPIRED'}),Object.assign(new ScanError('not found'),{remoteStatus:404})]) {
    calls=0;await assert.rejects(fetchSitePage(page.url,{transport:async()=>{calls++;throw error;}}));assert.equal(calls,1);
  }
});

test('page timeout preserves independent reputation in an honest report and blocks advanced downloads',async()=> {
  let lookupStarted=false;let calls=0;let previews=0;
  const report=await scanSite('https://example.com/\uFFFC',{
    validate:async()=>{},lookup:async()=>{lookupStarted=true;return unknown;},
    transport:async()=>{calls++;await Promise.resolve();assert.equal(lookupStarted,true);throw timeout();},
    preview:async()=>{previews++;throw new Error('No unavailable-page preview');},
  });
  assert.equal(calls,2);assert.equal(previews,0);
  assert.equal(report.status,'unavailable');assert.equal(report.reputation.status,'not_found');
  assert.equal(report.pageFetch.reason,'timeout');assert.equal(report.pageFetch.attempts,2);
  assert.equal(report.inputAdjusted,true);assert.equal(report.url,page.url);
  assert.equal(report.title,'محتوای صفحه دریافت نشد');assert.deepEqual(report.files,[]);
  assert.equal(report.checks[0].status,'unavailable');assert.equal(report.checks[1].status,'done');
});

test('private input never reaches page or provider; a known threat still blocks a stalled page',async()=> {
  let calls=0;await assert.rejects(scanSite('http://127.0.0.1',{lookup:async()=>{calls++;return unknown;},transport:async()=>{calls++;return page;}}),{status:400});
  assert.equal(calls,0);
  const report=await scanSite(page.url,{validate:async()=>{},lookup:async()=>({status:'listed',message:'Known fixture threat'}),transport:async(url,{signal})=>new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException('Blocked','AbortError'));
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  })});
  assert.equal(report.status,'danger');assert.equal(report.pageFetch.reason,'threat_blocked');
});

test('recovered scan keeps actual page evidence, excluded download links and a usable server-issued report',async()=> {
  let calls=0;
  const report=await scanSite(page.url,{validate:async()=>{},lookup:async()=>unknown,transport:async()=>{if(++calls===1)throw timeout();return page;},preview:async()=>({status:'unavailable',detail:'Fixture preview disabled'})});
  assert.equal(report.title,'Recovered store');assert.equal(report.pageFetch.status,'done');
  assert.equal(report.pageFetch.attempts,2);assert.deepEqual(report.files,[]);assert.ok(report.linkInventory.links.some(link=>link.kind==='file'&&link.url==='https://example.com/mod.zip'));
  assert.ok(report.scanToken.startsWith('r1.'));
});

test('simultaneous page and provider failures remain inconclusive without false completed checks',async()=> {
  const report=await scanSite(page.url,{validate:async()=>{},transport:async()=>{throw timeout();},lookup:async()=>{throw new Error('Provider outage');}});
  assert.equal(report.status,'unavailable');assert.equal(report.reputation.status,'unavailable');
  assert.ok(report.checks.every(check=>check.status==='unavailable'));
  assert.match(report.pageFetch.detail,/وضعیت استعلام/);
  assert.doesNotMatch(report.pageFetch.detail,/استعلام پایگاه تهدید جداگانه انجام شده/);
});

test('explicit passive advanced mode can inspect a listed page while retaining its threat verdict',async()=>{
  const report=await scanSite(page.url,{allowThreatContent:true,validate:async()=>{},lookup:async()=>({status:'listed',message:'Synthetic listed fixture'}),transport:async()=>page,preview:async()=>{throw new Error('No dangerous preview');}});
  assert.equal(report.status,'danger');assert.equal(report.pageFetch.status,'done');assert.equal(report.files.length,0);assert.equal(report.preview.status,'skipped');
  let calls=0;await assert.rejects(scanSite('http://127.0.0.1/',{allowThreatContent:true,lookup:async()=>{calls++;}}),{status:400});assert.equal(calls,0);
});

test('DNS timeout remains a timeout rather than falsely declaring the domain nonexistent',async()=>{
  const report=await scanSite(page.url,{validate:async()=>{throw new ScanError('DNS slow',422,'dns_timeout');},lookup:async()=>unknown});
  assert.equal(report.status,'unavailable');assert.equal(report.pageFetch.reason,'timeout');
  assert.equal(report.inspectionLayers.length,15);assert.equal(report.inspectionLayers.find(row=>row.id==='identity').status,'unavailable');
});

test('a failed final-URL lookup preserves received independent evidence and marks provider coverage unavailable',async()=>{
  let calls=0;
  const report=await scanSite(page.url,{validate:async()=>{},lookup:async()=>{if(++calls>1)throw new Error('Fixture provider failure');return unknown;},transport:async()=>({...page,url:'https://final.example.com/',redirects:[{from:page.url,to:'https://final.example.com/',status:302}]})});
  assert.equal(report.title,'Recovered store');assert.equal(report.finalReputation.status,'unavailable');
  assert.equal(report.inspectionLayers.find(row=>row.id==='reputation').status,'unavailable');
});
