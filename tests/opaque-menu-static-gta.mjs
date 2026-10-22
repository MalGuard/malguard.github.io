// Regression: opaque global hamburger + neutral home notice + static GTA Guard demo.
// Local HTTPS only; no external URL, no actual file scanning or uploading.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const name=process.env.TEST_BROWSER||'chromium';
const browser=await (name==='webkit'?webkit:chromium).launch(launchOptions(name));
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   ignoreHTTPSErrors:true,viewport:{width,height:850},reducedMotion:'reduce'
  });
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  for(const path of ['/','/gta-guard.html']){
   const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200,path+' HTTP failure');
   await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true',null,{timeout:12000});
   const menu=page.locator('#menuBtn');
   await menu.click();
   const state=await page.evaluate(()=>{
    const el=document.querySelector('#navLinks'),style=getComputedStyle(el);
    return {bg:style.backgroundColor,blur:style.backdropFilter,zIndex:style.zIndex,
      links:[...el.querySelectorAll('a')].map(x=>x.getAttribute('href')),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   assert.equal(state.bg,'rgb(11, 15, 21)','menu translucent or blue');
   assert.equal(state.blur,'none','old translucent blur leaked through');
   assert.ok(state.links.includes('/gta6-security.html'),'GTA VI missing from hamburger');
   assert.ok(state.overflow<=2,path+' horizontal overflow at '+width);
   assert.equal(await menu.getAttribute('aria-expanded'),'true','hamburger did not open');
   await page.keyboard.press('Escape');
   assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape did not close');
   if(path==='/'){
    const promo=await page.locator('.gta6-home-notice').evaluate(el=>({
     bg:getComputedStyle(el).backgroundColor,
     border:getComputedStyle(el).borderColor,
     action:getComputedStyle(el.querySelector('a')).backgroundColor}));
    assert.equal(promo.bg,'rgb(17, 21, 27)','GTA VI promo remains blue');
    assert.equal(promo.action,'rgb(233, 235, 239)','GTA VI action is not neutral');
   }else{
    assert.equal(await page.locator('body.gta-static').count(),1,'old animated GTA story still enabled');
    assert.equal(await page.locator('#gta-scene,.gate-perspective,.journey-copy,.journey-rail').count(),0,
      'old 3D or cinematic journey DOM still included');
    assert.equal(await page.locator('script[src*="gta-guard.js"]').count(),0,'heavy 3D engine still requested');
    assert.equal(await page.locator('canvas').count(),0,'unexpected WebGL canvas');
    await page.waitForFunction(()=>document.documentElement.dataset.gtaStaticReady==='true',null,{timeout:9000});
    assert.ok(await page.locator('#gta-stage').evaluate(el=>getComputedStyle(el).backgroundImage.includes('gta-card-960.webp')),
      'lost original card photo on static hero');
    for(const [value,expected] of [['1','Inconclusive'],['0','Suspicious'],['2','No scripted indicators'],['3','Malicious']]){
     await page.locator('#sample-select').selectOption(value);
     await page.locator('#scan-button').click();
     assert.equal(await page.locator('#result-title').innerText(),expected,'demo outcome changed '+value);
     assert.equal(await page.locator('#scan-progress').getAttribute('aria-valuenow'),'100');
     assert.equal(await page.locator('#evidence-details').count(),1);
    }
   }
   console.log('PASS opaque menu, neutral promo, static GTA demo',name,width,path);
  }
  assert.deepEqual(errors,[],'page script errors');
  await context.close();
 }
}finally{await browser.close();}
