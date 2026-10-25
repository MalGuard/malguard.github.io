// Dedicated native-navigation regression. Does not depend on obsolete
// product-hero assets or on unrelated product backend/API tests.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';

const base='https://127.0.0.1:8443';
const browserNames=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
for(const browserName of browserNames){
 assert.ok(['chromium','webkit'].includes(browserName),'Unsupported browser');
 const browser=await (browserName==='chromium'?chromium:webkit).launch(launchOptions(browserName));
 try{
  for(const width of [390,1440]){
   for(const reduced of [false,true]){
    const context=await browser.newContext({
     ignoreHTTPSErrors:true,viewport:{width,height:900},
     reducedMotion:reduced?'reduce':'no-preference'
    });
    await context.route('**/*',route=>
     new URL(route.request().url()).origin===new URL(base).origin?
      route.continue():route.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
     const response=await page.goto(base+'/',{waitUntil:'domcontentloaded'});
     assert.equal(response?.status(),200,'Homepage unavailable');
     await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
     assert.equal(await page.locator('#navbar .mg-brand').isVisible(),true,'Navigation brand is hidden by typing');
     assert.equal(await page.locator('#menuBtn').isVisible(),true,'Menu waits for typing');
     assert.equal(await page.locator('.hero-actions>a.button').first().isVisible(),true,'Primary CTA waits for typing');
     assert.equal(await page.locator('.hero-actions>a.button').first().evaluate(a=>getComputedStyle(a).pointerEvents),'auto');
     assert.equal(await page.locator('#products article.product').count(),3);
     const card=page.locator('#products article.product').first();
     await card.scrollIntoViewIfNeeded();
     const cardState=await card.evaluate(el=>({
      opacity:Number(getComputedStyle(el).opacity),
      pointerEvents:getComputedStyle(el).pointerEvents,
      href:el.querySelector('a.text-link')?.getAttribute('href')
     }));
     assert.ok(cardState.opacity>.9,'A pending card should never disappear');
     assert.notEqual(cardState.pointerEvents,'none','A pending card must allow clicks');
     assert.equal(cardState.href,'/gta-guard.html','Destination changed');
     // Click the upper corner, outside the visible CTA. Native stretched
     // anchor must navigate; no custom JS timeout or transition handoff.
     const started=Date.now();
     await card.click({position:{x:14,y:14},timeout:4500,noWaitAfter:true});
     await page.waitForURL('**/gta-guard.html',{timeout:8000});
     assert.ok(Date.now()-started<6000,'Card click was delayed by decorative animations');
     assert.equal(await page.locator('main h1').count(),1,'Destination heading missing');
     // Keyboard follows the same native link semantics after returning.
     await page.goBack({waitUntil:'domcontentloaded'});
     await page.locator('#products a.text-link').first().focus();
     await page.keyboard.press('Enter');
     await page.waitForURL('**/gta-guard.html',{timeout:8000});
     assert.deepEqual(errors,[],'Uncaught runtime errors during navigation');
     console.log('PASS native navigation',browserName,width,reduced?'reduced':'normal');
    }finally{await context.close();}
   }
  }
 }finally{await browser.close();}
}
