import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parsePage,scanSite} from './scanner.js';
import {createReportTokens} from './report-token.js';

test('independent form analysis reports actual destinations and methods without entered values or action tokens',()=>{
  const report=parsePage(Buffer.from('<form action="http://other.example/pay?token=do-not-copy" method="get"><input type="password" value="entered-secret"><input autocomplete="cc-number" value="card-secret"></form>'),'https://store.example/');
  const rules=report.signals.map(signal=>signal.rule);
  assert.ok(rules.includes('sensitive_form_http'));assert.ok(rules.includes('sensitive_form_external'));assert.ok(rules.includes('sensitive_form_get'));
  assert.match(report.signals.find(signal=>signal.rule==='sensitive_form_external').detail,/http:\/\/other.example\/pay/);
  for(const secret of ['entered-secret','card-secret','do-not-copy'])assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(report.siteAnalysis.sensitiveForms,1);assert.equal(report.siteAnalysis.javaScriptExecuted,false);
});

test('document base is used for download discovery and form action, while omitted action uses document URL',()=>{
  const report=parsePage(Buffer.from('<base href="https://cdn.example/mods/"><a href="file.zip">Mod</a><form method="post"><input type="password"></form><form action="pay" method="post"><input autocomplete="cc-number"></form>'),'https://store.example/shop/');
  assert.equal(report.files[0].url,'https://cdn.example/mods/file.zip');
  assert.equal(report.linkInventory.links[0].url,report.files[0].url);
  const signals=report.signals.filter(signal=>signal.rule==='sensitive_form_external');assert.equal(signals.length,1);assert.match(signals[0].detail,/فرم 2.*cdn.example\/mods\/pay/);
  assert.ok(!report.signals.some(signal=>signal.rule==='sensitive_form_get'));
});

test('inline and mixed script evidence is inspected without executing code or treating JSON as executable',()=>{
  const encoded='<script>eval(atob("fixture"));</script><script src="http://cdn.example/code.js"></script>';
  const report=parsePage(Buffer.from(encoded),'https://store.example/');
  assert.ok(report.signals.some(signal=>signal.rule==='encoded_dynamic_code'));
  assert.ok(report.signals.some(signal=>signal.rule==='active_mixed_content'));
  assert.ok(report.signals.every(signal=>signal.level!=='danger'));
  const json=parsePage(Buffer.from('<script type="application/ld+json">{"text":"eval(atob("}</script>'),'https://store.example/');
  assert.equal(json.siteAnalysis.nonExecutableScripts,1);assert.ok(!json.signals.some(signal=>signal.rule==='encoded_dynamic_code'));
});

test('all 54 observed link rows and exact received-HTML hash are retained without claiming destination scans',()=>{
  const html=Buffer.from(Array.from({length:54},(_,i)=>`<a href="/mod-${i}.zip">Mod ${i}</a>`).join(''));
  const report=parsePage(html,'https://store.example/');
  assert.equal(report.linkInventory.total,54);assert.equal(report.linkInventory.retained,54);assert.equal(report.linkInventory.omitted,0);
  assert.ok(report.linkInventory.links.every(link=>link.status==='unscanned'));
  assert.equal(report.fileCount,54);assert.equal(report.files.length,54);
  assert.equal(report.siteAnalysis.htmlSha256,createHash('sha256').update(html).digest('hex'));
});

test('duplicate, nonweb and over-budget inventory rows stay accounted for; meta redirects are only observed',()=>{
  const html=Buffer.from('<meta http-equiv="refresh" content="0; url=https://other.example/next"><a href="/one#first">One</a><a href="/one#last">Again</a><a href="javascript:alert(1)">JS</a>'+Array.from({length:160},(_,i)=>`<a href="/item-${i}">Item</a>`).join(''));
  const report=parsePage(html,'https://store.example/');
  assert.equal(report.linkInventory.total,163);assert.equal(report.linkInventory.retained+report.linkInventory.omitted,163);
  assert.equal(report.linkInventory.links[1].duplicateOf,1);assert.equal(report.linkInventory.links[2].kind,'unsupported');
  assert.equal(report.siteAnalysis.refreshCount,1);assert.ok(report.signals.some(signal=>signal.rule==='html_external_redirect'));
});

test('new independent report survives a cross-instance capability with no threat-provider credentials',async()=>{
  const html=Buffer.from('<title>Independent fixture</title>'+Array.from({length:54},(_,i)=>`<a href="/file-${i}.zip">File</a>`).join(''));
  let downloads=0;
  const report=await scanSite('https://store.example/',{validate:async()=>{},lookup:async()=>({status:'unconfigured',message:'No key'}),preview:async()=>({status:'unavailable',detail:'Fixture preview disabled'}),transport:async()=>{downloads++;return {status:200,headers:{'content-type':'text/html'},bytes:html,url:'https://store.example/',redirects:[]};}});
  assert.equal(downloads,1);assert.equal(report.reputation.status,'unconfigured');assert.equal(report.siteAnalysis.status,'done');
  assert.ok(report.checks.some(check=>check.title==='تحلیل مستقل محتوای HTML'&&check.status==='done'));
  const capabilities=createReportTokens({secret:'fixture-secret-for-independent-site'.repeat(2)});
  const restored=capabilities.read(capabilities.issue(report),report.id).result;
  assert.equal(restored.linkInventory.retained,54);assert.equal(restored.siteAnalysis.htmlSha256,report.siteAnalysis.htmlSha256);
});
