// Run only inside `firebase emulators:exec --only hosting --project demo-malguard1`.
// Native fetch connects to localhost; these checks never contact a live site.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = 'http://127.0.0.1:5000';
for (const [url, file, mime, cache] of [
  ['/', 'index.html', 'text/html', 'no-cache'],
  ['/download.html', 'download.html', 'text/html', 'no-cache'],
  ['/research/gta-mod-security-fa.html', 'research/gta-mod-security-fa.html', 'text/html', 'no-cache'],
  ['/ios-preview/', 'ios-preview/index.html', 'text/html', 'no-cache'],
  ['/.well-known/security.txt', '.well-known/security.txt', 'text/plain'],
  ['/assets/i18n.mjs', 'assets/i18n.mjs', 'javascript'],
  ['/release/malguard-current-release.json', 'release/malguard-current-release.json', 'application/json', 'no-cache'],
  ['/data/product-status.json', 'data/product-status.json', 'application/json', 'no-cache'],
]) {
  const response = await fetch(`${base}${url}`, { redirect: 'manual' });
  assert.equal(response.status, 200, url);
  assert.ok(response.headers.get('content-type')?.includes(mime), `${url}: MIME type`);
  if (cache) assert.equal(response.headers.get('cache-control'), cache, `${url}: cache header`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(`_site/${file}`), `${url}: source bytes`);
  console.log(`PASS local Hosting ${url}`);
}
for (const url of ['/missing-firebase-route', '/api/game-scam-scan.js', '/private-download-service/api/installer.js', '/.github/workflows/static.yml', '/firebase.json']) {
  const response = await fetch(`${base}${url}`, { redirect: 'manual' });
  assert.equal(response.status, 404, `${url}: must not resolve to the homepage or backend`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync('_site/404.html'), `${url}: custom 404`);
  console.log(`PASS local Hosting 404 ${url}`);
}
