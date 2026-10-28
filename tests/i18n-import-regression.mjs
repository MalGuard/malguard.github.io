// Ensure optional translation imports cannot crash navigation or first paint.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const paths=['/core-guide.html','/ai-intelligence.html','/malware-ai.html'];
for(const engine of (process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'])){
 const browser=await (engine==='chromium'?chromium:webkit).launch(launchOptions(engine));
 try{
  for(const width of [390,820]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:850},reducedMotion:'reduce'});
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/assets/i18n-catalog.mjs')return route.abort('failed');
    return url.origin===new URL(base).origin?route.continue():route.abort();
   });
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   for(const path of paths){
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
   }
   await page.waitForTimeout(150);
   assert.deepEqual(errors,[],engine+' '+width+': '+errors.join('; '));
   await context.close();
   console.log('PASS optional i18n import',engine,width);
  }
 }finally{await browser.close();}
}
