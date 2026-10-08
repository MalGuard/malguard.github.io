import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash, createCipheriv} from 'node:crypto';
import {createPasswordDownloadHandler, passwordDownloadKey} from '../lib/password-download.mjs';
import {PART_BYTES} from '../lib/download.mjs';

const code = 'MG-' + Array(8).fill('ABCD').join('-');
const wrong = 'MG-' + Array(8).fill('EFGH').join('-');
const origin = 'https://malguard.github.io';
const hash = data => createHash('sha256').update(data).digest('hex');

async function fixture(t, options = {}) {
  const build = 'synthetic-password-test';
  const salt = 'a'.repeat(64);
  const plaintext = Buffer.alloc(options.size || PART_BYTES + 111, 9);
  const nonce = Buffer.alloc(12, 3);
  const cipher = createCipheriv('aes-256-gcm', passwordDownloadKey(code, salt, build), nonce);
  cipher.setAAD(Buffer.from('MGDL1:' + build));
  const sealed = Buffer.concat([Buffer.from('MGDL1\0'), nonce, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const metadata = {build, passwordSalt: salt, filename: 'synthetic.bin', size: plaintext.length,
    sha256: hash(plaintext), sealedSha256: hash(sealed)};
  if (options.corrupt) sealed[30] ^= 1;
  if (options.badHash) metadata.sha256 = 'f'.repeat(64);
  let reads = 0;
  const handler = createPasswordDownloadHandler({metadata, origin, readSealed: async () => {
    reads++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return sealed;
  }});
  const server = createServer((req, res) => handler(req, res).catch(() => res.destroy()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  return {url: 'http://127.0.0.1:' + server.address().port, plaintext, reads: () => reads};
}

const request = (url, body = {code, part: 0}, method = 'POST', requestOrigin = origin) => fetch(url, {
  method, headers: {Origin: requestOrigin, 'Content-Type': 'application/json'},
  ...(method === 'POST' ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})
});

test('complete password-authorized download over 32 MiB matches every byte without environment secrets', async t => {
  const f = await fixture(t, {size: 33 * 1024 * 1024 + 17});
  const chunks = [];
  for (let part = 0; part < Math.ceil(f.plaintext.length / PART_BYTES); part++) {
    const response = await request(f.url, {code: code.toLowerCase(), part});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-file-sha256'), hash(f.plaintext));
    chunks.push(Buffer.from(await response.arrayBuffer()));
  }
  assert.deepEqual(Buffer.concat(chunks), f.plaintext);
  assert.equal(f.reads(), 1);
});

test('correct then wrong then correct password never bypasses cache authorization', async t => {
  const f = await fixture(t);
  const first = await request(f.url);assert.equal(first.status, 200);await first.arrayBuffer();
  const denied = await request(f.url, {code: wrong, part: 1});
  assert.equal(denied.status, 403);assert.deepEqual(await denied.json(), {error: 'ACCESS_DENIED'});
  const last = await request(f.url, {code, part: 1});
  assert.equal(last.status, 200);
  assert.deepEqual(Buffer.from(await last.arrayBuffer()), f.plaintext.subarray(PART_BYTES));
  assert.equal(f.reads(), 1);
});

test('concurrent first downloads keep shared responses intact and read ciphertext once', async t => {
  const f = await fixture(t);
  const responses = await Promise.all([request(f.url), request(f.url, {code, part: 1})]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const parts = await Promise.all(responses.map(response => response.arrayBuffer()));
  assert.deepEqual(Buffer.concat(parts.map(part => Buffer.from(part))), f.plaintext);
  assert.equal(f.reads(), 1);
});

for (const [name, value, status] of [
  ['wrong', {code: wrong, part: 0}, 403], ['empty', {code: '', part: 0}, 403],
  ['missing', {part: 0}, 400], ['array', [code, 0], 400],
  ['extra flag', {code, part: 0, publicAccess: true}, 400],
  ['path', {code, part: 0, path: '../installer.exe'}, 400],
  ['fraction', {code, part: 0.5}, 400], ['negative', {code, part: -1}, 400],
  ['oversized part', {code, part: 2}, 400], ['malformed', '{bad', 400],
  ['oversized body', 'x'.repeat(600), 400]
]) test(name + ' request cannot receive installer bytes', async t => {
  const f = await fixture(t);const response = await request(f.url, value);
  assert.equal(response.status, status);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.ok((await response.text()).length < 100);
});

test('GET, wrong origin and OPTIONS never deliver installer bytes', async t => {
  const f = await fixture(t);
  assert.equal((await request(f.url, undefined, 'GET')).status, 405);
  assert.equal((await request(f.url, undefined, 'POST', 'https://example.invalid')).status, 403);
  const preflight = await request(f.url, undefined, 'OPTIONS');
  assert.equal(preflight.status, 204);assert.equal((await preflight.arrayBuffer()).byteLength, 0);
  assert.equal(f.reads(), 0);
});

for (const problem of ['corrupt', 'badHash']) test(problem + ' returns no installer plaintext', async t => {
  const f = await fixture(t, {[problem]: true});const response = await request(f.url);
  assert.equal(response.status, 503);assert.deepEqual(await response.json(), {error: 'DOWNLOAD_UNAVAILABLE'});
});

test('well-formed wrong passwords hit a bounded instance limiter', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 8; i++) assert.equal((await request(f.url, {code: wrong, part: 0})).status, 403);
  assert.equal((await request(f.url)).status, 429);
  assert.equal(f.reads(), 1);
});

test('key derivation separates builds, salts and normalized codes', () => {
  const salt = 'a'.repeat(64);
  assert.deepEqual(passwordDownloadKey(code, salt, 'build-a'), passwordDownloadKey(code.toLowerCase(), salt, 'build-a'));
  assert.notDeepEqual(passwordDownloadKey(code, salt, 'build-a'), passwordDownloadKey(code, salt, 'build-b'));
  assert.notDeepEqual(passwordDownloadKey(code, salt, 'build-a'), passwordDownloadKey(code, 'b'.repeat(64), 'build-a'));
  assert.throws(() => passwordDownloadKey('', salt, 'build-a'));
});
