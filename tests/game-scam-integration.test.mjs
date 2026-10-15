import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');
test('cloud collector identity and server-only artifact boundary are preserved',async()=>{
  const bytes=await readFile(new URL('../services/game-scam-guard/server/cloud-execution-worker.py',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'1886250255a8d690a362b5f6aa5a343b1c65de291e0d9bea2136b245c45b951b');
  const config=JSON.parse(await read('vercel.json'));
  assert.equal(config.functions['api/game-scam-guard.js'].maxDuration,180);
  assert.ok(config.functions['api/game-scam-guard.js'].includeFiles.includes('cloud-execution-worker.py'));
  const build=await read('tools/build-public-site.py');
  assert.ok(build.includes("root/'services/game-scam-guard/dist',out/'game-scam-guard'"));
  assert.ok(build.includes("for forbidden in ['services','api'"));
});
test('public entry opens the first-party GameScam Guard route without embedded access token',async()=>{
  const page=await read('game-scam-guard.html');
  assert.ok(page.includes('id="gameScamPreview"'));
  assert.ok(page.includes('href="/game-scam-guard/"'));
  assert.ok(!/_vercel_share|protection-bypass|previewPassword/.test(page));
  assert.ok(page.includes('Windows · Coming Soon'));
  assert.ok(page.includes('each require separate consent'));
});
test('PWA identity and assets stay inside GameScam Guard path',async()=>{
  const manifest=JSON.parse(await read('services/game-scam-guard/public/manifest.webmanifest'));
  assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.id,'./');
  assert.ok(manifest.icons.every(icon=>icon.src.startsWith('./icons/')));
  const source=await read('services/game-scam-guard/src/main.jsx');
  assert.ok(source.includes('`${import.meta.env.BASE_URL}sw.js`'));
  assert.ok(source.includes("from './api.js'"));
  const api=await read('services/game-scam-guard/src/api.js');
  assert.ok(api.includes("'https://game-scam-guard-connected.vercel.app'"));
  assert.ok(api.includes('/api/game-scam-guard/${endpoint}'));
  assert.ok(!source.includes("fetch('/api/health')"));
});
test('scoped service worker ignores parent pages, APIs, foreign sites and unsafe methods',async()=>{
  const listeners={};let cached;
  const context={self:{location:{href:'https://example.test/game-scam-guard/sw.js',origin:'https://example.test'},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},URL,caches:{open:async()=>({addAll:async urls=>cached=urls}),keys:async()=>[]}};
  vm.runInNewContext(await read('services/game-scam-guard/public/sw.js'),context);
  let install;listeners.install({waitUntil:promise=>install=promise});await install;
  assert.deepEqual([...cached],['/game-scam-guard/','/game-scam-guard/manifest.webmanifest','/game-scam-guard/favicon.svg']);
  for(const [url,method,mode]of [['/','GET','navigate'],['/download.html','GET','navigate'],['/api/game-scam-guard/scan','GET','navigate'],['/game-scam-guard/unknown-file.exe','GET','no-cors'],['https://foreign.test/game-scam-guard/','GET','navigate'],['/game-scam-guard/','POST','navigate']]){
    let handled=false;listeners.fetch({request:{url:new URL(url,context.self.location.origin).href,method,mode},respondWith:()=>handled=true});assert.equal(handled,false,url);
  }
});
