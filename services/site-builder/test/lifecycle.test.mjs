import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { blobStore } from '../src/blob.js';
import { handle, lifetime } from '../src/agent.js';

function fixture(now) {
  const records = new Map();
  let version = 0;
  const client = {
    async get(key, options) {
      assert.equal(options.access, 'private');
      assert.equal(options.useCache, false);
      const record = records.get(key);
      if (record) return { stream: new Response(record.data).body, blob: { etag: record.etag } };
      return null;
    },
    async put(key, data, options) {
      const current = records.get(key);
      if ((options.ifMatch && current?.etag !== options.ifMatch) ||
          (options.allowOverwrite === false && current)) throw new BlobPreconditionFailedError();
      assert.equal(options.ttlDays, 1);
      records.set(key, { data, etag: String(++version) });
    }
  };
  return blobStore('test-token', client, now);
}

test('preview GET and ZIP acceptance share the same source and prevent further public reads', async () => {
  const store = fixture();
  const token = '1'.repeat(64);
  const id = 'logo-' + '2'.repeat(24);
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  const html = '<html lang="fa" dir="rtl"><p>طراحی لوگو</p></html>';
  await store.create(id, html, hash, lifetime);
  const url = 'https://agent.example';
  const env = { APP_HOST: 'agent.example', PREVIEW_ON_APP: '1' };
  const preview = () => handle(new Request(url + '/preview/' + id), env, 'preview', store);
  const accept = value => handle(new Request(url + '/api/accept', {
    method: 'POST', headers: { origin: url, 'content-type': 'application/json' },
    body: JSON.stringify({ id, token: value })
  }), env, 'accept', store);
  const page = await preview();
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal(await page.text(), html);
  assert.equal((await accept('0'.repeat(64))).status, 403);
  const zip = await accept(token);
  assert.equal(zip.headers.get('content-type'), 'application/zip');
  const bytes = Buffer.from(await zip.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.subarray(40, 40 + Buffer.byteLength(html)).toString(), html);
  assert.equal((await preview()).status, 410);
});

test('expiry deadline and concurrent free quota are enforced', async () => {
  let time = 1000;
  const store = fixture(() => time);
  const id = 'logo-' + '2'.repeat(24);
  assert.equal(await store.create(id, 'source', 'owner', lifetime), time + lifetime);
  time += lifetime;
  assert.deepEqual(await store.view(id), [410]);
  assert.deepEqual(await store.accept(id, 'owner'), [410]);
  const results = await Promise.all(Array.from({length: 8}, (_, i) =>
    store.reserve('quota:build:2026-11-22', 'account', 'reservation-' + i, 100, 3)));
  assert.equal(results.filter(Boolean).length, 3);
  await store.finish('quota:build:2026-11-22', 'reservation-0', false);
  assert.equal(await store.reserve('quota:build:2026-11-22', 'account', 'new-reservation', 100, 3), true);
});

test('authenticated Persian build sends the selected model and returns a 20-minute preview', async t => {
  const now = 1_800_000_000_000;
  const store = fixture(() => now);
  const app = 'https://agent.example';
  const prompt = 'یک سایت برای طراحی لوگو بساز';
  const html = '<!doctype html><html lang="fa" dir="rtl"><body>طراحی لوگو</body></html>';
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    seen.push(String(url));
    const payload = JSON.parse(options.body);
    if (String(url).startsWith('https://api.malguard.site/')) {
      assert.equal(payload.sessionToken, 'verified-account-fixture');
      return Response.json({ email: 'tester@example.com', expiresAt: Date.now() + 10000 });
    }
    assert.equal(options.headers.Authorization, 'Bearer verified-account-fixture');
    assert.equal(payload.model, 'cf_gptoss120');
    assert.equal(payload.mode, 'code');
    assert.match(payload.message, new RegExp(prompt));
    assert.equal(payload.consent.modelShare, true);
    return Response.json({ modelId: 'cf_gptoss120', text: JSON.stringify({ slug: 'logo', html }) });
  });
  const env = { APP_HOST: 'agent.example', PREVIEW_ON_APP: '1' };
  const created = await handle(new Request(app + '/api/build', {
    method: 'POST', headers: {
      origin: app, 'content-type': 'application/json', authorization: 'Bearer verified-account-fixture'
    },
    body: JSON.stringify({ prompt, consent: { modelShare: true } })
  }), env, 'build', store);
  assert.equal(created.status, 201);
  const preview = await created.json();
  assert.match(preview.url, /^https:\/\/agent\.example\/preview\/logo-[a-f0-9]{24}$/);
  assert.equal(preview.expiresAt, now + lifetime);
  assert.equal(await (await handle(new Request(preview.url), env, 'preview', store)).text(), html);
  assert.deepEqual(seen, [
    'https://api.malguard.site/api/game-scam-guard/auth/session',
    'https://models.malguard.site/api/public-model-chat'
  ]);
});

test('the model selects whether to search and supplies the public query', async t => {
  let searches = [];
  let shouldSearch = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://api.malguard.site/')) {
      return Response.json({email:'tester@example.com', expiresAt:Date.now() + 10000});
    }
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'cf_gptoss120');
    if (body.message.startsWith('You control the optional web search tool.')) {
      assert.equal(body.webMode, undefined);
      return Response.json({text:shouldSearch ? 'latest browser support for CSS grid' : 'NONE'});
    }
    if (body.webMode === 'web') searches.push(body.searchQuery);
    return Response.json({
      text:'Here is the answer.',
      ...(body.webMode === 'web' ? {webSearch:{state:'completed',sources:[{url:'https://example.com/ref',title:'Reference'}]}} : {})
    });
  });
  const env = {APP_HOST:'agent.example'};
  const store = fixture();
  const send = async prompt => {
    const stages = [];
    const response = await handle(new Request('https://agent.example/api/chat', {
      method:'POST', headers:{origin:'https://agent.example','content-type':'application/json',authorization:'Bearer verified-account-fixture'},
      body:JSON.stringify({prompt, webSearch:true, consent:{modelShare:true,remoteLookup:true}})
    }), env, 'chat', store, stage => stages.push(stage));
    assert.equal(response.status, 200);
    return {result:await response.json(), stages};
  };
  const ordinary = await send('Explain grid layout.');
  assert.equal(ordinary.result.webStatus, 'off');
  assert.deepEqual(searches, []);
  assert.ok(!ordinary.stages.includes('searching'));
  shouldSearch = true;
  const fresh = await send('What is the latest browser support for CSS grid?');
  assert.deepEqual(searches, ['latest browser support for CSS grid']);
  assert.ok(fresh.stages.includes('searching'));
  assert.ok(fresh.result.sources.some(source => source.url === 'https://example.com/ref'));
});

test('typing is emitted only after the upstream model sends visible text', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://api.malguard.site/')) {
      return Response.json({email:'tester@example.com',expiresAt:Date.now()+10000});
    }
    assert.equal(options.headers.Accept, 'application/x-ndjson');
    const events = [
      {type:'delta',text:'Hello'},
      {type:'result',status:200,data:{modelId:'cf_gptoss120',text:'Hello'}}
    ];
    return new Response(events.map(event=>JSON.stringify(event)+'\n').join(''), {
      headers:{'content-type':'application/x-ndjson'}
    });
  });
  const stages = [];
  const response = await handle(new Request('https://agent.example/api/chat', {
    method:'POST',headers:{origin:'https://agent.example','content-type':'application/json',authorization:'Bearer verified-account-fixture'},
    body:JSON.stringify({prompt:'Say hello',consent:{modelShare:true}})
  }), {APP_HOST:'agent.example'}, 'chat', fixture(), (stage, detail, text)=>stages.push({stage,text}));
  assert.equal((await response.json()).text, 'Hello');
  assert.deepEqual(stages.map(event=>event.stage), ['thinking','typing']);
  assert.equal(stages[1].text, 'Hello');
});
