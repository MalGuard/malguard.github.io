import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';

const browser=await chromium.launch(launchOptions('chromium'));
const base='http://127.0.0.1:8790/';
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'no-preference'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await page.locator('.product-art[data-reveal=visual]').count(),3);
  assert.equal(await page.locator('.flow-stage[data-reveal=visual]').count(),1);
  const pending=await page.locator('#technology [data-type-state=pending] > .type-source').first().evaluate(node=>getComputedStyle(node).color);
  assert.match(pending,/, 0\)$/,'Queued text was visible before typing');
  const image=page.locator('.product-art[data-reveal=visual]').last();
  assert.equal(await image.evaluate(node=>getComputedStyle(node).opacity),'0','Queued image was visible before reveal');
  const sample=await page.waitForFunction(()=>{const node=document.querySelector('.type.typing'),source=node?.querySelector(':scope > .type-source'),ink=node?.querySelector(':scope > .type-ink');return source&&ink?{source:getComputedStyle(source).color,ink:getComputedStyle(ink).clipPath}:false;},null,{timeout:12000});
  const active=await sample.jsonValue();
  assert.match(active.source,/, 0\)$/,'Original text was visible behind animated text');
  assert.equal(active.ink,'none');
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.product-art')].at(-1)?.dataset.revealState==='complete',null,{timeout:30000});
  assert.equal(await image.evaluate(node=>getComputedStyle(node).opacity),'1');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 const reduced=await browser.newPage({reducedMotion:'reduce'});
 await reduced.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(await reduced.locator('html.type-system').count(),0);
 assert.equal(await reduced.locator('.product-art').first().evaluate(node=>getComputedStyle(node).opacity),'1');
 await reduced.close();
 console.log('PASS precision text and visual reveal at 390px and 1280px; reduced motion remains visible');
}finally{await browser.close();}
