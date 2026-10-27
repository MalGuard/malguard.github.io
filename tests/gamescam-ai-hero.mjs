// Verify Game Scam Guard responsive brandmark illustration and site-wide typing speed.
// Local HTTPS only. Branding is a visual illustration, never proof of vendor integration.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const js=readFileSync('assets/precision/site.js','utf8');
assert.match(js,/per:29,min:230,max:455/,'button timing should be slightly faster');
assert.match(js,/per:39,min:335,max:900/,'title timing should be slightly faster');
assert.match(js,/per:21,min:360,max:1320/,'body timing should be slightly faster');
const root='https://127.0.0.1:8443',browserName=process.env.TEST_BROWSER||'chromium';
const browser=await(browserName==='webkit'?webkit:chromium).launch(launchOptions(browserName));
try{
 for(const width of [390,820,1280]){
  const context=await browser.newContext({
   ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'
  });
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(root).origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const r=await page.goto(root+'/game-scam-guard.html',{waitUntil:'domcontentloaded'});
  assert.equal(r?.status(),200,'missing Game Scam Guard page');
  await page.locator('#game-scam-title').waitFor({state:'visible'});
  assert.equal(await page.locator('main h1').count(),1);
  assert.match(await page.locator('.mg-card-hero--scam').innerText(),/cannot guarantee safety/);
  assert.equal(await page.locator('.scam-hero-actions a[download]').getAttribute('href'),'/release/GameScam-Guard-1.1.0-android.apk');
  assert.equal(await page.locator('.scam-hero-actions a').last().getAttribute('href'),'/game-scam-guard/');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('.scam-model-mark').count(),0,'Do not imply unconnected provider integrations');
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS widened copy and staggered logo trio',browserName,width);
  await context.close();
 }
}finally{await browser.close()}
