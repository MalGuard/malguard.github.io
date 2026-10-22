// Internal pages must use the same typing sequence and coding font as home.
// Test static copy only; never submit forms or contact external services.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const paths=['/products.html','/tools.html','/about.html','/gta-guard.html','/research/repackaged-mod.html'];
for(const engine of (process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'])){
 const browser=await (engine==='chromium'?chromium:webkit).launch(launchOptions(engine));
 try{
  for(const path of paths){
   for(const reduced of [true,false]){
    const context=await browser.newContext({ignoreHTTPSErrors:true,
     viewport:{width:reduced?390:1280,height:850},reducedMotion:reduced?'reduce':'no-preference'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200,path+' returned an HTTP error');
    await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true',null,{timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true',null,{timeout:12000});
    const status=await page.evaluate(()=>({
     main:document.querySelectorAll('main [data-type]').length,
     nav:document.querySelector('#navbar')?.dataset.reveal,
     brand:document.querySelector('#navbar .mg-brand')?.dataset.type,
     titleFont:getComputedStyle(document.querySelector('main h1')).fontFamily,
     navFont:getComputedStyle(document.querySelector('#navbar .mg-brand')).fontFamily,
     scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,
     ctas:document.querySelectorAll('main a[data-type="button"]').length,
     script:[...document.scripts].some(s=>s.src.includes('site.js?v=unified-coding-20261022'))
    }));
    assert.ok(status.script,path+' uses outdated script');
    assert.ok(status.main>0,path+' has no queued page copy');
    assert.equal(status.nav,'nav',path+' does not queue header');
    assert.equal(status.brand,'button',path+' does not type brand');
    assert.match(status.titleFont,/MGPrecisionMono|JetBrains/,path+' title not in coding font');
    assert.match(status.navFont,/MGPrecisionMono|JetBrains/,path+' navbar font not in coding font');
    assert.ok(status.scroll<=status.width+2,path+' horizontal overflow at '+(reduced?390:1280));
    if(['/products.html','/gta-guard.html'].includes(path))
     assert.ok(status.ctas>0,path+' does not type action buttons');
    if(reduced){
     assert.equal(await page.locator('.type-ink').count(),0,path+' ignores reduce-motion');
     assert.equal(await page.locator('.type-system').count(),0,path+' hides text with reduce-motion');
     const nav=page.locator('#menuBtn');
     await nav.click();
     assert.equal(await nav.getAttribute('aria-expanded'),'true',path+' menu fails');
     await page.keyboard.press('Escape');
     assert.equal(await nav.getAttribute('aria-expanded'),'false',path+' escape fails');
    }else{
     await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navMotion==='complete',null,{timeout:15000});
     await page.waitForFunction(()=>document.querySelector('main [data-type]')?.dataset.typeRuns>0,null,{timeout:15000});
     assert.ok(await page.locator('[data-type-state=typing]').count()<=1,path+' multiple typewriters running');
     await page.emulateMedia({reducedMotion:'reduce'});
     await page.waitForFunction(()=>!document.documentElement.classList.contains('type-system'),null,{timeout:10000});
    }
    assert.deepEqual(errors,[],path+' browser exceptions');
    console.log('PASS shared coding UI',engine,path,reduced?'reduced/mobile':'desktop/typing');
    await context.close();
   }
  }
 }finally{await browser.close();}
}
