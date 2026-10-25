import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrchestrator} from '../server/orchestrator.js';
import {parseRequest,report} from '../server/contracts.js';
import {createFileSandbox} from '../server/adapters/file-sandbox.js';
import {createUrlSandbox} from '../server/adapters/url-sandbox.js';
import {cloudExecutionStatus,CLOUD_COLLECTOR_SHA256} from '../../game-scam-guard/server/cloud-execution.js';
const file={name:'private-fixture.js',base64:Buffer.from('secret-file-bytes').toString('base64')};
const disabled={status:()=>({state:'disabled'})};
const urlEnv={GUARD_CLOUD_PREVIEW_ENABLED:'true',GUARD_BROWSER_SNAPSHOT_ID:'fixture-snapshot'};
test('ordinary chat URL/hash prose never routes tools, explicit inspection requires workspace',async()=>{
 let tools=0,models=0;
 const adapter={status:()=>({state:'available'}),run:()=>{tools++;throw new Error('must not inspect');}};
 const o=createOrchestrator({game_scam_guard:adapter,malwarebazaar:adapter},{status:()=>({state:'configured'}),respond:async message=>{models++;return {text:message};}});
 for(const message of ['Explain https://example.com/',`Explain ${'a'.repeat(64)}`]){
  assert.deepEqual(parseRequest({message}).input,{});
  assert.equal((await o.run({message,consent:{modelShare:true}})).generated.text,message);
 }
 for(const body of [{tool:'game_scam_guard',input:{url:'https://example.com/'}},{input:{file}},{tool:'file_sandbox',input:{file}}])await assert.rejects(o.run({...body,consent:{modelShare:true,fileUpload:true,websiteFetch:true,isolatedExecution:true}}),/workspace_required/);
 assert.equal(tools,0);assert.equal(models,2);
});
test('sandbox consents precede all adapter calls even when sandbox is disabled',async()=>{
 let calls=0,refreshes=0;
 const a={status:()=>({state:'disabled'}),refresh:()=>{refreshes++;},run:()=>{calls++;}};
 const o=createOrchestrator({file_sandbox:a,url_sandbox:a},disabled);
 for(const tool of ['file_sandbox','url_sandbox']){
  const input=tool==='file_sandbox'?{file}:{url:'https://example.com/'};
  await assert.rejects(o.run({mode:'worker',tool,input,consent:{fileUpload:true,websiteFetch:true}}),/isolated_execution_consent_required/);
  await assert.rejects(o.run({mode:'worker',tool,input,consent:{isolatedExecution:true}}),/file_consent_required|website_consent_required/);
 }
 assert.equal(calls,0);assert.equal(refreshes,0);
 assert.throws(()=>parseRequest({consent:{isolatedExecution:'true'}}));
});
test('file sandbox preserves current collector hash gate and does not execute unsupported formats',async()=>{
 const env={GUARD_CLOUD_EXECUTION_ENABLED:'true',GUARD_CLOUD_FREE_QUOTA_CONFIRMED:'true',GUARD_CLOUD_ISOLATION_VALIDATED:'true',GUARD_CLOUD_VALIDATED_DRIVER_SHA256:'188625-not-current'};
 assert.match(CLOUD_COLLECTOR_SHA256,/^[a-f0-9]{64}$/);assert.equal(cloudExecutionStatus(env).ready,false);
 let calls=0;const gated=createFileSandbox({capability:()=>cloudExecutionStatus(env),behavior:()=>{calls++;}});
 assert.equal(gated.status().state,'disabled');
 const gate=await gated.run({file:{name:file.name,bytes:Buffer.from('fixture')}},{consent:{isolatedExecution:true,fileUpload:true}});
 assert.equal(gate.metadata.executed,false);assert.equal(gate.metadata.attempted,false);assert.equal(calls,0);
 const a=createFileSandbox({capability:()=>({ready:true})});
 for(const [name,bytes] of [['fixture.exe',Buffer.from('MZfixture')],['fixture.bin',Buffer.from([0,1,2])]]){
  const r=await a.run({file:{name,bytes}},{consent:{isolatedExecution:true,fileUpload:true}});
  assert.equal(r.metadata.executed,false);assert.equal(r.metadata.attempted,false);assert.equal(r.outcome,'insufficient');
 }
});
test('file sandbox returns bounded observations, never raw sample output or fabricated safety',async()=>{
 const a=createFileSandbox({capability:()=>({ready:true}),behavior:async()=>({status:'done',executed:true,attempted:true,teardownConfirmed:true,runtime:'js',execution:{exitCode:0,durationMs:3},isolation:{uid:1000,noNewPrivileges:true,networkProbeDenied:true,appSecretsAbsent:true},createdFiles:[{name:'private-output'}],untrustedOutputExcerpt:'raw-secret-output'})});
 const r=await a.run({file:{name:'fixture.js',bytes:Buffer.from('fixture')}},{consent:{isolatedExecution:true,fileUpload:true}});
 assert.equal(r.metadata.executed,true);assert.equal(r.metadata.teardownConfirmed,true);assert.equal(r.metadata.isolation.networkProbeDenied,true);assert.equal(r.metadata.createdFileCount,1);assert.equal(r.outcome,'insufficient');
 assert.ok(!JSON.stringify(r).includes('raw-secret-output'));assert.ok(!JSON.stringify(r).includes('private-output'));assert.ok(!r.limitations.some(v=>v.includes('No sample was executed')));
});
test('URL sandbox requires preview gates and returns only isolated snapshot metadata',async()=>{
 let calls=0;const gated=createUrlSandbox({env:{},scan:()=>{calls++;}});
 assert.equal(gated.status().state,'disabled');await gated.run({url:'https://example.com/'},{consent:{isolatedExecution:true,websiteFetch:true}});assert.equal(calls,0);
 for(const env of [{GUARD_CLOUD_PREVIEW_ENABLED:'true'},{GUARD_BROWSER_SNAPSHOT_ID:'fixture'}])assert.equal(createUrlSandbox({env}).status().state,'disabled');
 const a=createUrlSandbox({env:urlEnv,preview:async()=>({status:'done',image:'raw-image-secret',isolation:{javaScriptEnabled:false,networkPolicy:'deny-all',siteScriptsExecuted:false,documentServed:true,blockedRequests:3}}),scan:async(url,options)=>{
  assert.equal(options.allowCloudPreview,true);assert.equal(options.allowThreatContent,false);assert.equal(options.retainReport,false);assert.equal(typeof options.transport,'function');assert.equal((await options.lookup(url)).status,'unconfigured');
  return {signals:[],pageFetch:{status:'done'},preview:await options.preview(url,Buffer.from('private-html-secret')),limitations:[]};
 }});
 const r=await a.run({url:'https://example.com/'},{signal:new AbortController().signal,consent:{isolatedExecution:true,websiteFetch:true}});
 assert.equal(a.status().state,'configured');assert.equal(r.metadata.previewRendered,true);assert.equal(r.metadata.executed,false);assert.equal(r.metadata.attempted,true);assert.equal(r.metadata.isolation.siteScriptsExecuted,false);assert.equal(r.outcome,'insufficient');
 assert.ok(!JSON.stringify(r).includes('private-html-secret'));assert.ok(!JSON.stringify(r).includes('raw-image-secret'));
});
test('workspace plan receives only original request and fixed instructions, failure retains real report',async()=>{
 const actual=report('gta_guard','insufficient',{metadata:{secretEvidence:'must-not-share'}}),seen=[];
 const adapter={status:()=>({state:'available'}),run:async()=>actual};
 const model={status:()=>({state:'configured'}),respond:async(...args)=>{seen.push(args);return {text:'A proposed plan',model:'fixture',provider:'fixture'};}};
 const o=createOrchestrator({gta_guard:adapter},model);
 const body={mode:'worker',tool:'gta_guard',model:'cf_gptoss120',message:'Inspect this attachment',input:{file},history:[{role:'user',content:'private-history'}],consent:{fileUpload:true}};
 assert.deepEqual((await o.run(body)).result,actual);assert.equal(seen.length,0);
 const r=await o.run({...body,consent:{...body.consent,modelShare:true}});
 assert.deepEqual(r.result,actual);assert.equal(r.workPlan.text,'A proposed plan');assert.equal(r.workspaceModel,'cf_gptoss120');
 assert.match(seen[0][0],/You have no file or tool evidence/);assert.match(seen[0][0],/Inspect this attachment/);assert.deepEqual(seen[0][2],[]);assert.equal(seen[0][3],'cf_gptoss120');assert.deepEqual(seen[0][4],{modelShare:true,remoteLookup:false});
 assert.ok(!JSON.stringify(seen).includes(file.name));assert.ok(!JSON.stringify(seen).includes('secret-file-bytes'));assert.ok(!JSON.stringify(seen).includes('must-not-share'));assert.ok(!JSON.stringify(seen).includes('private-history'));
 model.respond=async()=>{throw new Error('private-upstream-detail');};
 const failed=await o.run({...body,consent:{...body.consent,modelShare:true}});assert.deepEqual(failed.result,actual);assert.deepEqual(failed.workPlanError,{error:'model_unavailable'});assert.ok(!JSON.stringify(failed).includes('private-upstream-detail'));
});
