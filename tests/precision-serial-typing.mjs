// Performance regression: public copy is never typed, queued or withheld.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
for(const name of engines){
 const browser=await (name==='webkit'?webkit:chromium).launch(launchOptions(name));
 try{
  for(const width of [320,390,820,1440]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'no-preference'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await page.goto(base+'/',{waitUntil:'domcontentloaded'})).status(),200);
   await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
   const snapshot=()=>page.evaluate(()=>({
    mode:document.documentElement.dataset.precisionMotionOrder,
    typeSystem:document.documentElement.classList.contains('type-system'),
    ink:document.querySelectorAll('.type-ink,.type-cursor,.mg-precision-type-target').length,
    typing:document.querySelectorAll('[data-type-state="typing"],[data-type-state="pending"]').length,
    heading:document.getElementById('hero-title')?.textContent.trim(),
    body:document.querySelector('.hero-description .type-source')?.textContent.trim(),
    technology:document.getElementById('technology-title')?.textContent.trim(),
    productNames:[...document.querySelectorAll('#products .product h3')].map(n=>n.textContent.trim()),
    viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
   }));
   const first=await snapshot();
   assert.equal(first.mode,'instant');
   assert.equal(first.typeSystem,false);
   assert.equal(first.ink,0);
   assert.equal(first.typing,0);
   assert.ok(first.heading?.includes('MalGuard'));
   assert.ok(first.body?.length>30,'Intro must be in HTML without animation');
   assert.ok(first.technology?.length>5,'Offscreen copy must be present immediately');
   assert.equal(first.productNames.length,3);
   assert.ok(first.productNames.every(Boolean));
   assert.ok(first.scroll<=first.viewport+2,'Horizontal overflow at '+width);
   await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   const after=await snapshot();
   assert.deepEqual(after,first,'Scrolling must not start or retype text');
   const menu=page.locator('#menuBtn');
   await page.waitForFunction(()=>document.getElementById('navbar')?.dataset.navigationReady==='true');
   await menu.click();
   assert.equal(await menu.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');
   assert.equal(await menu.getAttribute('aria-expanded'),'false');
   assert.deepEqual(errors,[],'Browser JavaScript error');
   await context.close();
   console.log('PASS instant visible homepage copy',name,width);
  }
 }finally{await browser.close();}
}
