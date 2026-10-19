import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteProviderStatus, startBrowserbaseLive, fetchWithTinyFish } from './remote-browser.js';

const json = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) });

test('remote-provider status never exposes keys', () => {
  assert.deepEqual(remoteProviderStatus({ BROWSERBASE_API_KEY: 'bb-secret', TINYFISH_API_KEY: 'tiny-secret' }), { browserbase: true, tinyfish: true });
  assert.deepEqual(remoteProviderStatus({}), { browserbase: false, tinyfish: false });
});

test('Browserbase live view is created server-side with restricted public navigation', async () => {
  const requests = [], events = [];
  const page = { on: () => {}, goto: async url => { assert.equal(url, 'https://store.example/'); } };
  const context = { route: async handler => { requests.push({ route: handler }); }, pages: () => [page] };
  const browser = { contexts: () => [context], close: async () => { events.push('closed'); } };
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/sessions')) return json({ id: 'session_1', connectUrl: 'wss://fixture', expiresAt: '2030-01-01T00:00:00Z' }, 201);
    if (url.includes('/sessions/session_1/debug')) return json({ debuggerFullscreenUrl: 'https://live.example/session_1' });
    throw new Error('Unexpected request');
  };
  const output = await startBrowserbaseLive('https://store.example/', { env: { BROWSERBASE_API_KEY: 'fixture', BROWSERBASE_PROJECT_ID: 'project_1' }, fetchImpl, connect: async url => { assert.equal(url, 'wss://fixture'); return browser; }, onLiveReady: event => events.push(event.liveUrl) });
  assert.equal(output.status, 'done');
  assert.equal(output.liveUrl, 'https://live.example/session_1');
  assert.deepEqual(events, ['https://live.example/session_1', 'closed']);
  const creation = requests.find(item => item.url?.endsWith('/sessions'));
  assert.equal(creation.options.method, 'POST');
  assert.equal(JSON.parse(creation.options.body).browserSettings.allowedDomains[0], 'store.example');
  assert.equal(JSON.parse(creation.options.body).timeout, 60);
});

test('TinyFish Fetch sends only a public URL and records no page body', async () => {
  let call;
  const output = await fetchWithTinyFish('https://store.example/', { env: { TINYFISH_API_KEY: 'fixture' }, fetchImpl: async (url, options) => { call = { url, options }; return json({ results: [{ final_url: 'https://store.example/', title: 'Store', description: 'Games', language: 'en', latency_ms: 42, text: 'not retained' }], errors: [] }); } });
  assert.equal(output.status, 'done');
  assert.equal(output.title, 'Store');
  assert.equal('text' in output, false);
  assert.equal(call.url, 'https://api.fetch.tinyfish.ai');
  assert.deepEqual(JSON.parse(call.options.body).urls, ['https://store.example/']);
});

test('unconfigured remote providers fail closed without network calls', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('must not call'); };
  assert.equal((await startBrowserbaseLive('https://example.com/', { env: {}, fetchImpl })).status, 'unavailable');
  assert.equal((await fetchWithTinyFish('https://example.com/', { env: {}, fetchImpl })).status, 'unavailable');
  assert.equal(calls, 0);
});
