import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readPreviewImage,renderCloudPreview } from './cloud-browser.js';

test('SDK Node streams are read completely, while oversized or empty previews are rejected', async()=> {
  assert.equal((await readPreviewImage(Readable.from([Buffer.from('JPEG'),Buffer.from('image')]),9)).toString(),'JPEGimage');
  const oversized=Readable.from([Buffer.alloc(5),Buffer.alloc(5)]);
  assert.equal(await readPreviewImage(oversized,6),null);
  assert.equal(oversized.destroyed,true);
  assert.equal(await readPreviewImage(Readable.from([])),null);
});

test('cloud preview cannot start a metered VM without explicit server opt-in',async()=>{
  const previous=process.env.GUARD_CLOUD_PREVIEW_ENABLED;
  try {
    delete process.env.GUARD_CLOUD_PREVIEW_ENABLED;
    const result=await renderCloudPreview('https://example.com/',Buffer.from('<title>Fixture</title>'));
    assert.equal(result.status,'unavailable');assert.match(result.detail,/کنترل هزینه/);assert.equal(result.image,undefined);
  }finally{if(previous===undefined)delete process.env.GUARD_CLOUD_PREVIEW_ENABLED;else process.env.GUARD_CLOUD_PREVIEW_ENABLED=previous;}
});

test('cloud snapshot enforces deny-all VM options, forwards no host secrets and requires isolation telemetry',async()=>{
 const prior={enabled:process.env.GUARD_CLOUD_PREVIEW_ENABLED,snapshot:process.env.GUARD_BROWSER_SNAPSHOT_ID,key:process.env.ABUSECH_AUTH_KEY};
 process.env.GUARD_CLOUD_PREVIEW_ENABLED='true';process.env.GUARD_BROWSER_SNAPSHOT_ID='owned-snapshot-fixture';process.env.ABUSECH_AUTH_KEY='host-secret-do-not-copy';
 try{
  for(const invalid of [false,'scripts','network','missing']){
   let stopped=0,written;
   const telemetry={javaScriptEnabled:invalid==='scripts',networkPolicy:invalid==='network'?'allow-all':'deny-all',siteScriptsExecuted:false,blockedRequests:3,documentServed:true};
   const result=await renderCloudPreview('https://example.com/',Buffer.from('<title>Owned fixture</title>'),{createSandbox:async options=>{
    assert.equal(options.networkPolicy,'deny-all');assert.equal(options.persistent,false);assert.deepEqual(options.ports,[]);assert.equal(options.timeout,40000);assert.equal(options.env,undefined);
    return {mkDir:async()=>{},writeFiles:async files=>{written=files;},runCommand:async()=>({exitCode:0}),readFile:async({path})=>path.endsWith('.json')?(invalid==='missing'?null:Readable.from([Buffer.from(JSON.stringify(telemetry))])):Readable.from([Buffer.from([0xff,0xd8,0xff,0xd9])]),stop:async()=>{stopped++;}};
   }});
   assert.equal(stopped,1);assert.equal(written.length,3);assert.ok(written.some(file=>file.path.endsWith('preview-renderer.mjs')));assert.ok(written.every(file=>!file.content.toString().includes('host-secret-do-not-copy')));
   assert.equal(result.status,invalid?'unavailable':'done');if(invalid)assert.equal(result.image,undefined);else assert.equal(result.isolation.javaScriptEnabled,false);
  }
 }finally{for(const [env,value]of [['GUARD_CLOUD_PREVIEW_ENABLED',prior.enabled],['GUARD_BROWSER_SNAPSHOT_ID',prior.snapshot],['ABUSECH_AUTH_KEY',prior.key]]){if(value===undefined)delete process.env[env];else process.env[env]=value;}}
});
