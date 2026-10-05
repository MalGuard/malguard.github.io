import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, createCipheriv } from 'node:crypto';
import { createDownloadHandler, normalizeCode, PART_BYTES } from '../lib/download.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const origin = 'https://malguard.github.io';
const code = 'MG-' + Array(8).fill('ABCD').join('-');
const normalized = normalizeCode(code);

async function fixture(t, change = {}) {
  const key = Buffer.alloc(32, 13);
  const nonce = Buffer.alloc(12, 19);
  const plaintext = Buffer.alloc(PART_BYTES + 71, 7); // inert synthetic bytes
  const build = 'synthetic-test';
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from('MGDL1:' + build));
  let sealed = Buffer.concat([Buffer.from('MGDL1\0'), nonce, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const metadata = { build, size: plaintext.length, sha256: hash(plaintext), sealedSha256: hash(sealed), filename: 'synthetic.bin' };
  if (change.corrupt) { sealed = Buffer.from(sealed); sealed[31] ^= 1; }
  if (change.badTag) { sealed = Buffer.from(sealed); sealed[sealed.length - 1] ^= 1; metadata.sealedSha256 = hash(sealed); }
  if (change.badHash) metadata.sha256 = 'a'.repeat(64);
  if (change.badAad) metadata.build = 'changed-build';
  let reads = 0;
  const handler = createDownloadHandler({
    metadata,
    origin,
    getSecrets: () => ({ key: change.noKey ? undefined : key.toString('hex'), codeHash: hash(normalized) }),
    readSealed: async () => { reads += 1; return sealed; }
  });
  const server = createServer((req, res) => { handler(req, res).catch(() => { res.destroy(); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = 'http://127.0.0.1:' + server.address().port;
  return { url, plaintext, reads: () => reads };
}

function request(url, body = { code, part: 0 }, headers = {}, method = 'POST') {
  return fetch(url, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}

test('access code normalizes case and separators without accepting arbitrary input', () => {
  assert.equal(normalizeCode(code.toLowerCase()), normalized);
  for (const bad of [null, {}, '', 'x'.repeat(200), code + '<script>', 'MG-1234', code.replace('A', '\u202e')]) {
    assert.equal(normalizeCode(bad), null);
  }
});

test('authorized parts reconstruct exactly the inert fixture with no public GET access', async t => {
  const f = await fixture(t);
  const parts = [];
  for (let part = 0; part < 2; part++) {
    const res = await request(f.url, { code, part });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-part-index'), String(part));
    assert.equal(res.headers.get('x-file-sha256'), hash(f.plaintext));
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.ok(bytes.length <= PART_BYTES);
    parts.push(bytes);
  }
  assert.deepEqual(Buffer.concat(parts), f.plaintext);
  assert.equal(f.reads(), 1);
  assert.equal((await request(f.url, undefined, {}, 'GET')).status, 405);
});

for (const [name, body, expected] of [
  ['wrong code', { code: 'MG-' + Array(8).fill('EEEE').join('-'), part: 0 }, 403],
  ['empty code', { code: '', part: 0 }, 403],
  ['missing code', { part: 0 }, 400],
  ['array body', [code, 0], 400],
  ['extra path', { code, part: 0, path: '../../secret' }, 400],
  ['fractional part', { code, part: 0.5 }, 400],
  ['negative part', { code, part: -1 }, 400],
  ['oversized part', { code, part: 2 }, 400],
  ['string part', { code, part: '0' }, 400],
  ['malformed JSON', '{broken', 400],
  ['oversized JSON', 'x'.repeat(600), 400]
]) test(name + ' denies access before reading any ciphertext', async t => {
  const f = await fixture(t);
  assert.equal((await request(f.url, body)).status, expected);
  assert.equal(f.reads(), 0);
});

for (const [name, headers, expected] of [
  ['other origin', { Origin: 'https://example.invalid' }, 403],
  ['null origin', { Origin: 'null' }, 403],
  ['wrong content type', { 'Content-Type': 'text/plain' }, 415]
]) test(name + ' denies delivery', async t => {
  const f = await fixture(t);
  assert.equal((await request(f.url, undefined, headers)).status, expected);
  assert.equal(f.reads(), 0);
});

for (const problem of ['noKey', 'corrupt', 'badTag', 'badHash', 'badAad']) {
  test(problem + ' fails closed without returning bytes', async t => {
    const f = await fixture(t, { [problem]: true });
    const res = await request(f.url);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'DOWNLOAD_UNAVAILABLE' });
  });
}

test('concurrent authorized requests retain intact output', async t => {
  const f = await fixture(t);
  const results = await Promise.all([request(f.url), request(f.url)]);
  for (const res of results) assert.deepEqual(Buffer.from(await res.arrayBuffer()), f.plaintext.subarray(0, PART_BYTES));
});

test('wrong-code attempts receive a bounded instance rate limit', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 8; i++) assert.equal((await request(f.url, { code: '', part: 0 })).status, 403);
  assert.equal((await request(f.url, { code: '', part: 0 })).status, 429);
  assert.equal(f.reads(), 0);
});

test('valid preflight carries no file bytes', async t => {
  const f = await fixture(t);
  const res = await request(f.url, undefined, {}, 'OPTIONS');
  assert.equal(res.status, 204);
  assert.equal((await res.arrayBuffer()).byteLength, 0);
  assert.equal(f.reads(), 0);
});
