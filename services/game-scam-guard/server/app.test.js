import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { ScanError } from './network.js';

test('disconnected clients retain scan slots until the actual work settles', async () => {
  const pending = [];
  let disconnected = 0;
  let workStarted;
  const allStarted = new Promise(resolve => { workStarted = resolve; });
  let allClosed;
  const closed = new Promise(resolve => { allClosed = resolve; });
  const app = createApp({scanSite: url => {
    if (url === 'probe') return Promise.resolve({status:'probe'});
    return new Promise(resolve => {
      pending.push(resolve);
      if (pending.length === 8) workStarted();
    });
  }});
  const server = app.listen(0,'127.0.0.1');
  server.on('request',(req,res) => {
    if (req.headers['x-test-hold']) res.once('close',() => {
      if (++disconnected === 8) allClosed();
    });
  });
  await once(server,'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/scan`;
  const controllers = Array.from({length:8},() => new AbortController());
  const post = (body,options={}) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify({url:body}),signal:options.signal});
  const requests = controllers.map(controller => post('hold',{signal:controller.signal,headers:{'x-test-hold':'1'}}).catch(() => null));
  try {
    await allStarted;
    assert.equal((await post('probe')).status,503);
    for (const controller of controllers) controller.abort();
    await closed;
    assert.equal((await post('probe')).status,503,'Closing the connection must not free unfinished scan work');
    assert.equal((await fetch(url.replace('/scan','/advanced'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
    for (const resolve of pending) resolve({status:'finished'});
    await Promise.all(requests);
    // A health response crosses the event loop after the settled handlers release their slots.
    await fetch(url.replace('/scan','/health'));
    assert.equal((await post('probe')).status,200,'Settled work must release its slots');
  } finally {
    controllers.forEach(controller => controller.abort());
    pending.forEach(resolve => resolve({status:'finished'}));
    await Promise.all(requests);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('failed scans release their slots and preserve the JSON error response', async () => {
  const app = createApp({scanSite:async () => {throw new ScanError('fixture failure',422);}});
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  try {
    for (let i=0;i<9;i++) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/scan`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,422);
      assert.deepEqual(await response.json(),{error:'fixture failure'});
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
