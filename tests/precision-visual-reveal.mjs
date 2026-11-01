// Static copy and all homepage product art stay visible without a reveal queue.
import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const browser=await chromium.launch(launchOptions('chromium'));
const base='http://127.0.0.1:8790/';
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0);
  assert.equal(await page.locator('.product-art[data-reveal=visual]').count(),3);
  assert.equal(await page.locator('.flow-stage[data-reveal=visual]').count(),1);
  const source=await page.locator('#technology h2').first().textContent();
  assert.ok(source.trim().length>5);
  assert.ok(await page.locator('.product-art[data-reveal=visual]').evaluateAll(nodes=>
   nodes.every(n=>getComputedStyle(n).opacity==='1')));
  await page.locator('#technology').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#technology h2').first().textContent(),source);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});
 await reduced.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(await reduced.locator('html.type-system').count(),0);
 assert.equal(await reduced.locator('.product-art').first().evaluate(n=>getComputedStyle(n).opacity),'1');
 await reduced.close();
 console.log('PASS instant readable copy, images and reduced motion');
}finally{await browser.close();}
