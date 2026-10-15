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
