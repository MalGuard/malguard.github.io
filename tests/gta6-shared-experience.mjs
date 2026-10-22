// GTA VI page should behave exactly like the shared MalGuard editorial experience.
// All checks run against the local HTTPS fixture; never submit external requests.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const url='https://127.0.0.1:8443/gta6-security.html';
for(const engineName of [process.env.TEST_BROWSER||'chromium']){
 const engine=engineName==='webkit'?webkit:chromium;
 const browser=await engine.launch(launchOptions(engineName));
 try{
  for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
   for(const reduced of [true,false]){
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport,reducedMotion:reduced?'reduce':'no-preference'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200,'GTA VI route failed');
    await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true',null,{timeout:12000});
    await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true',null,{timeout:12000});
    const initial=await page.evaluate(()=>({
     menuOpen:document.querySelector('#menuBtn')?.getAttribute('aria-expanded'),
     menuHidden:document.querySelector('#navLinks')?.hidden,
     script:[...document.scripts].some(s=>s.src.includes('site.js?v=slightly-faster-typing-20261022')),
     titleLines:document.querySelectorAll('#gta6-heading .gta6-type-line[data-type="title"]').length,
     buttons:document.querySelectorAll('.gta6-actions a[data-type="button"]').length,
     width:document.documentElement.clientWidth,
     scroll:document.documentElement.scrollWidth
    }));
    assert.equal(initial.menuOpen,'false','hamburger must start closed');
    assert.equal(initial.menuHidden,true,'dropdown is always open');
    assert.ok(initial.script,'missing shared typewriter');
    assert.equal(initial.titleLines,3,'hero headline must type three lines');
    assert.ok(initial.buttons>=2,'GTA VI actions not registered for typing');
    assert.ok(initial.scroll<=initial.width+2,'horizontal overflow');
    const menu=page.locator('#menuBtn');
    if(!reduced){
     await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navMotion==='complete',null,{timeout:25000});
     await page.waitForFunction(()=>[...document.querySelectorAll('#gta6-heading .gta6-type-line')].some(e=>Number(e.dataset.typeRuns)>0),null,{timeout:15000});
    }
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'),'true','hamburger cannot open');
    assert.ok(await page.locator('#navLinks').isVisible(),'open dropdown not visible');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape should close menu');
    await page.locator('#gta6-url-input').fill('https://example.com/offer');
    await page.locator('#gta6-url-form button[type=submit]').click();
    assert.ok(await page.locator('#gta6-url-result').isVisible(),'local URL review not working');
    assert.deepEqual(errors,[],'browser page errors');
    console.log('PASS GTA VI header, typewriter and local review',engineName,viewport.width,reduced?'reduced':'normal');
    await ctx.close();
   }
  }
 }finally{await browser.close();}
}
