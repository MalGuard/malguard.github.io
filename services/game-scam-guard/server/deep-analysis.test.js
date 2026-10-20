import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePage,scanSite} from './scanner.js';
import {inspectJobTarget} from './scan-jobs.js';
import {analyzerCatalog} from '../shared/analyzer-catalog.js';
import {detectionFixtures,benignFixtures} from './analysis-fixtures.js';
import {runSelfTest} from './self-test.js';
import {scriptFacts} from './script-facts.js';

for(const fixture of detectionFixtures)test(`analysis detects ${fixture.module} with structured bilingual evidence`,()=>{
 const result=parsePage(Buffer.from(fixture.html),fixture.url);
 assert.equal(result.analysisEngine.modules.length,20);
 const signal=result.signals.find(item=>item.rule===fixture.rule);assert.ok(signal);
 assert.ok(signal.localized.en.title&&signal.localized.fa.title&&signal.localized.en.detail&&signal.localized.fa.detail);
 assert.equal(result.analysisEngine.limits.javaScriptExecuted,false);
});
for(const fixture of benignFixtures)test(`false-positive guard: ${fixture.name}`,()=>{
 const result=parsePage(Buffer.from(fixture.html),fixture.url);assert.deepEqual(result.signals.filter(item=>['warning','danger'].includes(item.level)),[]);
});
test('all 20 checks have a distinct fixture and both catalogue translations',()=>{
 assert.equal(new Set(analyzerCatalog.map(item=>item.id)).size,20);
 assert.deepEqual(new Set(detectionFixtures.map(item=>item.module)),new Set(analyzerCatalog.map(item=>item.id)));
 assert.ok(analyzerCatalog.every(item=>item.name.en&&item.name.fa&&item.description.en&&item.description.fa));
});
test('syntax, size and AST limits remain visible and never execute authored code',()=>{
 assert.equal(scriptFacts('function {').status,'incomplete');assert.equal(scriptFacts('x'.repeat(512*1024+1)).reason,'size');
 const result=parsePage(Buffer.from('<script>function {</script>'),'https://store.example/');
 assert.ok(result.analysisEngine.modules.some(item=>item.status==='incomplete'));assert.equal(result.analysisEngine.limits.omittedScripts,1);
 assert.equal(globalThis.__guardExecuted,undefined);scriptFacts('globalThis.__guardExecuted=true');assert.equal(globalThis.__guardExecuted,undefined);
});
test('offline self-test actually exercises detection, negatives, boundaries and report integrity',()=>{
 const report=runSelfTest();assert.equal(report.status,'passed');assert.equal(report.summary.total,38);assert.equal(report.summary.failed,0);
 assert.equal(report.scope,'synthetic-offline');assert.ok(report.durationMs<3000);
});

test('large flat ASTs stop at the node budget rather than overflowing an argument stack',()=>{
 const facts=scriptFacts('const a=['+'0,'.repeat(130000)+'0];');assert.equal(facts.status,'incomplete');assert.equal(facts.reason,'nodes');
});
test('omitted scripts, forms and frames remain incomplete rather than silently counted as fully checked',()=>{
 const html='<script>const count=1;</script>'.repeat(300)+'<form></form>'.repeat(257)+'<iframe></iframe>'.repeat(257);
 const result=parsePage(Buffer.from(html),'https://store.example/');assert.equal(result.analysisEngine.limits.omittedScripts,44);assert.equal(result.siteAnalysis.scriptSyntaxOmitted,44);assert.equal(result.analysisEngine.limits.omittedForms,1);assert.equal(result.analysisEngine.limits.omittedFrames,1);
 for(const id of ['script-obfuscation','wallet-secrets','frame-boundaries'])assert.equal(result.analysisEngine.modules.find(item=>item.id===id).status,'incomplete');
});
test('computed and optional call syntax is inspected while regular expressions and template examples stay inert',()=>{
 const active=parsePage(Buffer.from('<script>window["eval"](window["atob"]("aW5lcnQ="));eval?.(atob("aW5lcnQ="));</script>'),'https://store.example/');assert.ok(active.signals.some(item=>item.rule==='encoded_dynamic_code'));
 const example=parsePage(Buffer.from('<script>const sample=`eval(atob("example"))`;const pattern=/eval\\(atob/;</script>'),'https://store.example/');assert.ok(!example.signals.some(item=>item.rule==='encoded_dynamic_code'));
 const frame=parsePage(Buffer.from('<iframe srcdoc="&lt;form&gt;&lt;input type=password&gt;&lt;/form&gt;"></iframe>'),'https://store.example/');assert.ok(frame.signals.some(item=>item.rule==='active_embedded_document'));
});
test('unsupported script syntax produces the same incomplete verdict for submitted and linked pages',async()=>{
 const url='https://store.example/',page={url,status:200,bytes:Buffer.from('<html><script>function {</script></html>'),headers:{'content-type':'text/html'},redirects:[]};
 const options={validate:async()=>{},transport:async()=>page},lookup=async()=>({status:'not_found',message:'Owned fixture'});
 const root=await scanSite(url,{...options,lookup});const child=await inspectJobTarget({id:'fixture',url,kind:'page',name:'Fixture'},{...options,urlLookup:lookup});assert.equal(root.status,'unavailable');assert.equal(child.status,'unavailable');
});

test('long member chains and oversized form paths cannot overflow the scanner or its report evidence',()=>{
 const facts=scriptFacts('object'+'.member'.repeat(600)+'();');assert.equal(facts.status,'incomplete');assert.equal(facts.reason,'member-depth');
 const report=parsePage(Buffer.from('<form method="post" action="https://other.example/'+ 'a'.repeat(100000)+'?secret=do-not-copy"><input type="password"></form>'),'https://store.example/');
 assert.ok(JSON.stringify(report.signals).length<5000);assert.ok(!JSON.stringify(report).includes('do-not-copy'));assert.ok(report.signals.some(item=>item.rule==='sensitive_form_external'));
});

test('missing or failed required threat evidence stays incomplete in both scan paths',async()=>{
 const url='https://store.example/',page={url,status:200,bytes:Buffer.from('<html><p>Owned fixture</p></html>'),headers:{'content-type':'text/html'},redirects:[]};const options={validate:async()=>{},transport:async()=>page};
 for(const status of ['unconfigured','auth_error','unavailable']){
  const lookup=async()=>({status,message:'Owned provider fixture'});const root=await scanSite(url,{...options,lookup});const child=await inspectJobTarget({id:'fixture',url,kind:'page',name:'Fixture'},{...options,urlLookup:lookup});assert.equal(root.status,'unavailable');assert.equal(child.status,'unavailable');assert.equal(root.siteAnalysis.status,'done');
 }
 const lookup=async()=>({status:'not_found',message:'Owned sources',sources:[{provider:'urlhaus',status:'not_found',message:'Observed'},{provider:'openphish',status:'unconfigured',message:'Not requested'}]});assert.equal((await scanSite(url,{...options,lookup})).status,'limited','An explicitly disabled optional source does not invent a failed requested check');
});
