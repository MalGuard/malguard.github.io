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
     script:[...document.scripts].some(s=>s.src.includes('site.js?v=continue-visited-20261031')),
     titleLines:document.querySelectorAll('#gta6-heading .gta6-type-line').length,
     buttons:document.querySelectorAll('.gta6-actions a').length,
     width:document.documentElement.clientWidth,
     scroll:document.documentElement.scrollWidth
    }));
    assert.equal(initial.menuOpen,'false','hamburger must start closed');
    assert.equal(initial.menuHidden,true,'dropdown is always open');
    assert.ok(initial.script,'missing shared instant-copy controller');
    assert.equal(initial.titleLines,3,'all three headline lines remain visible');
    assert.ok(initial.buttons>=2,'GTA VI action buttons missing');
    assert.ok(initial.scroll<=initial.width+2,'horizontal overflow');
    const menu=page.locator('#menuBtn');
    assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0,
     'GTA VI content must be visible without typing');
    assert.equal(await page.locator('#navbar').getAttribute('data-nav-motion'),'complete');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'),'true','hamburger cannot open');
    assert.ok(await page.locator('#navLinks').isVisible(),'open dropdown not visible');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape should close menu');
    await page.locator('#gta6-url-input').fill('https://example.com/offer');
    await page.locator('#gta6-url-form button[type=submit]').click();
    assert.ok(await page.locator('#gta6-url-result').isVisible(),'local URL review not working');
    assert.deepEqual(errors,[],'browser page errors');
    console.log('PASS GTA VI header, instant copy and local review',engineName,viewport.width,reduced?'reduced':'normal');
    await ctx.close();
   }
  }
 }finally{await browser.close();}
}
