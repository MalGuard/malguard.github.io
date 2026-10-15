import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cloudExecutionStatus,runCloudBehavior,CLOUD_COLLECTOR_SHA256,CLOUD_IMAGE} from './cloud-execution.js';
const ready={GUARD_CLOUD_EXECUTION_ENABLED:'true',GUARD_CLOUD_FREE_QUOTA_CONFIRMED:'true',GUARD_CLOUD_ISOLATION_VALIDATED:'true',GUARD_CLOUD_VALIDATED_DRIVER_SHA256:CLOUD_COLLECTOR_SHA256,CLOUD_IMAGE};
test('execution requires free-quota and isolation gates; Windows is never mislabeled as Linux execution',async()=>{
  let calls=0;const Sandbox={create:async()=>{calls++;}};
  assert.equal(cloudExecutionStatus({}).ready,false);
  assert.equal((await runCloudBehavior(Buffer.from('fixture'),{name:'fixture.js',format:'Text / script'},{Sandbox,env:{}})).executed,false);
  assert.equal((await runCloudBehavior(Buffer.from('MZfixture'),{name:'fixture.exe',format:'PE / Windows executable'},{Sandbox,env:ready})).executed,false);assert.equal(calls,0);
});
test('cloud adapter isolates each job, verifies sample execution evidence and tears down even on errors',async()=>{
  const bytes=Buffer.from('console.log("synthetic fixture")');let options,stops=0;
  const sha=createHash('sha256').update(bytes).digest('hex');
  const Sandbox={create:async value=>{options=value;return {mkDir:async()=>{},writeFiles:async()=>{},runCommand:async()=>({exitCode:0,stdout:async()=>JSON.stringify({schema:1,sampleSha256:sha,execution:{started:true,exitCode:0},isolation:{uid:2000,noNewPrivileges:true,networkProbeDenied:true,appSecretsAbsent:true},createdFiles:[]})}),stop:async()=>{stops++;}};}};
  const result=await runCloudBehavior(bytes,{name:'fixture.js',format:'Text / script'},{Sandbox,env:ready});assert.equal(result.executed,true);assert.equal(result.teardownConfirmed,true);assert.equal(options.image,CLOUD_IMAGE);assert.equal(options.runtime,undefined);assert.equal(options.persistent,false);assert.equal(options.networkPolicy,'deny-all');assert.deepEqual(options.env,{});assert.deepEqual(options.ports,[]);assert.equal(stops,1);
  const broken={create:async()=>({mkDir:async()=>{throw new Error('fixture');},stop:async()=>{stops++;}})};
  assert.equal((await runCloudBehavior(bytes,{name:'fixture.js',format:'Text / script'},{Sandbox:broken,env:ready})).executed,false);assert.equal(stops,2);
});
