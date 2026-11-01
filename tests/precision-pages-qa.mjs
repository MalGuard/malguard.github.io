// Precision design system acceptance: page parity, bilingual docs and instant readable content.
// Browser fixture is local HTTPS; no request is sent to an external scanner endpoint.
import assert from 'node:assert/strict';
import {maximumSimultaneousJobsInRegion} from './precision-region-assertions.mjs';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const routes=['/products.html','/tools.html','/docs.html','/trust.html','/about.html','/gta-guard.html','/research/gta-5-mod-security.html','/research/gta-mod-security-fa.html','/game-scam-guard.html','/download.html','/services/game-scam-guard/public/learn/index.html'];
const browser=await chromium.launch(launchOptions('chromium'));
try {
 for(const width of [390,1440]){
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:850},reducedMotion:'reduce'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const page=await c.newPage();
  for(const route of routes){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,route+' serves HTML');
   await page.evaluate(()=>document.fonts.ready);
   const result=await page.evaluate(()=>{
    const h=document.querySelector('main h1')||document.querySelector('main h2');
    const body=document.body,doc=document.documentElement;
    return {shared:body.classList.contains('mg-precision-shared'),
      bg:getComputedStyle(body).backgroundColor,
      background:getComputedStyle(body).backgroundImage,
      heading:h?getComputedStyle(h).fontFamily:'',
      overflow:doc.scrollWidth>doc.clientWidth+1,
      typed:document.querySelectorAll('main .type-ink').length,
      primary:document.querySelector('main .btn.primary,main .button.primary'),
    };
   });
   assert.equal(result.shared,true,'Design opt-in missing on '+route);
   assert.equal(result.bg,'rgb(5, 5, 7)','Palette differs on '+route);
   assert.match(result.background,/radial-gradient/,'Space background missing on '+route);
   assert.match(result.heading,/MGPrecisionMono|JetBrains/i,'Heading coding font differs on '+route);
   assert.equal(result.overflow,false,'Horizontal overflow on '+route+' @'+width);
   assert.equal(result.typed,0,'Reduced motion must show all text on '+route);
   assert.ok(await page.locator('main h1').count(),'Semantic heading missing on '+route);
   console.log('PASS',width,route,'Precision palette, font, accessibility and responsive flow');
  }
  await c.close();
 }
 const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},reducedMotion:'no-preference'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const page=await c.newPage();
 for(const route of ['/products.html','/docs.html','/research/gta-mod-security-fa.html']){
  await page.goto(base+route);
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  const first=await page.locator('main h1').first().textContent();
  assert.ok(first.trim().length>5,route+' heading hidden on load');
  assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0,route+' still types content');
  const article=page.locator('main h2').first();
  if(await article.count()){
   const before=await article.textContent();
   await article.scrollIntoViewIfNeeded();
   assert.equal(await article.textContent(),before,route+' text changed on scroll');
  }
  console.log('PASS',route,'full content visible without typing or scroll delay');
 }
 await c.close();
}finally{await browser.close();}
