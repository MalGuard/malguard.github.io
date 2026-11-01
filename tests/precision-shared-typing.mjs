// All product and editorial pages render original HTML copy immediately.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const paths=['/products.html','/tools.html','/about.html','/gta-guard.html','/research/repackaged-mod.html'];
for(const name of (process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'])){
 const browser=await (name==='webkit'?webkit:chromium).launch(launchOptions(name));
 try{
  for(const path of paths)for(const width of [390,1280]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:850},reducedMotion:'no-preference'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await page.goto(base+path,{waitUntil:'domcontentloaded'})).status(),200);
   await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
   await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
   const snap=await page.evaluate(()=>({
    mode:document.documentElement.dataset.precisionMotionOrder,
    typeSystem:document.documentElement.classList.contains('type-system'),
    synthetic:document.querySelectorAll('.type-ink,.type-cursor,.mg-precision-type-target,[data-type-state=typing]').length,
    h1:document.querySelector('main h1')?.textContent.trim(),
    scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,
    nav:getComputedStyle(document.getElementById('navbar')).backgroundColor,
    dropdown:getComputedStyle(document.getElementById('navLinks')).backgroundColor
   }));
   assert.equal(snap.mode,'instant',path);
   assert.equal(snap.typeSystem,false,path);
   assert.equal(snap.synthetic,0,path);
   assert.ok(snap.h1?.length>4,path+' missing heading');
   assert.ok(snap.scroll<=snap.width+2,path+' horizontal overflow');
   assert.match(snap.nav,/rgba?\(16,\s*17,\s*22[,)]/,path+' changed header design');
   assert.equal(snap.dropdown,'rgb(11, 15, 21)',path+' navigation menu not opaque');
   const menu=page.locator('#menuBtn');
   await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true',path);
   await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false',path);
   assert.deepEqual(errors,[],path+' JS errors');
   await context.close();
   console.log('PASS instant editorial copy',name,path,width);
  }
 }finally{await browser.close();}
}
