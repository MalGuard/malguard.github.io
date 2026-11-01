// Regression for the CURRENT Precision homepage, not the removed 3D flip-card prototype.
// Covers browser engines, motion preferences, weak-GPU fallback, instant readable text, product navigation and layout without contacting external services.
import assert from 'node:assert/strict';
import {maximumSimultaneousJobsInRegion} from './precision-region-assertions.mjs';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
const names=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
for(const name of names){
 assert.ok(['chromium','webkit'].includes(name),'Unsupported browser');
 const browser=await (name==='chromium'?chromium:webkit).launch(launchOptions(name));
 try{
  for(const profile of [
   {width:320,height:740,reduced:true,gpu:false},
   {width:390,height:844,reduced:true,gpu:false},
   {width:820,height:900,reduced:true,gpu:false},
   {width:1440,height:900,reduced:true,gpu:false},
   {width:360,height:225,reduced:true,gpu:false},
   {width:390,height:844,reduced:false,gpu:true},
   {width:1440,height:900,reduced:false,gpu:true}
  ]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,
    viewport:{width:profile.width,height:profile.height},
    reducedMotion:profile.reduced?'reduce':'no-preference'});
   if(!profile.gpu)await context.addInitScript(()=>{
    const old=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
     return /webgl/i.test(type)?null:old.call(this,type,...args);
    };
   });
   await context.route('**/*',route=>
    new URL(route.request().url()).origin===new URL(base).origin?
    route.continue():route.abort());
   const page=await context.newPage(),errors=[],writes=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});
   const response=await page.goto(base+'/',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,'Homepage failed to load');
   await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
   await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
   await page.waitForFunction(()=>['vector','webgl'].includes(document.querySelector('.flow-stage')?.dataset.renderer));
   if(!profile.gpu)assert.equal(await page.locator('.flow-stage').getAttribute('data-renderer'),'vector','Disabled WebGL must use vector fallback');
   assert.equal(await page.locator('#products article.product').count(),3,'Three product cards retained');
   assert.deepEqual(await page.locator('#products article.product a.text-link').evaluateAll(nodes=>
    nodes.map(n=>new URL(n.href).pathname)),[
    '/gta-guard.html','/game-scam-guard.html','/ai-product.html'
   ],'Current public product destinations');
   assert.equal(await page.locator('#products canvas').count(),0,'No heavyweight product renderer');
   assert.ok(['vector','webgl'].includes(await page.locator('.flow-stage').getAttribute('data-renderer')),'Renderer must be initialized');
   const layout=await page.evaluate(()=>({
    width:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
    title:getComputedStyle(document.querySelector('h1')).fontFamily,
    heading:document.querySelector('h1')?.textContent.trim(),
    bodyBg:getComputedStyle(document.body).backgroundColor,
    bodyImage:getComputedStyle(document.body).backgroundImage,
    urls:[...document.querySelectorAll('#products .product-photo')].map(img=>img.getAttribute('src')),
   }));
   assert.ok(layout.scroll<=layout.width+1,'Horizontal overflow at '+profile.width);
   assert.match(layout.title,/JetBrains/i,'Homepage uses the bundled coding font');
   assert.ok(layout.heading,'Visible semantic homepage heading');
   assert.equal(layout.bodyBg,'rgb(5, 5, 7)','Homepage obsidian background');
   const depthLayer=page.locator('body.precision-home > .particle-atmosphere');
   // The premium background stays still at every scroll position. Nothing
   // should update pseudo-element transforms, use CSS animation, or execute
   // the retired scroll-parallax script.
   assert.equal(await page.locator('script[src*="deep-space-home.js"]').count(),0,
    'Homepage must not load scroll-driven particle JavaScript');
   const staticDepth=await depthLayer.evaluate(n=>{
    const before=getComputedStyle(n,'::before');
    const after=getComputedStyle(n,'::after');
    return {
     position:getComputedStyle(n).position,
     beforeAnimation:before.animationName,afterAnimation:after.animationName,
     beforeTransform:before.transform,afterTransform:after.transform,
     beforeImage:before.backgroundImage,afterImage:after.backgroundImage,
     viewportTop:Math.round(n.getBoundingClientRect().top),
     far:n.style.getPropertyValue('--mg-space-far'),
     near:n.style.getPropertyValue('--mg-space-near'),
    };
   });
   assert.equal(staticDepth.position,'fixed','Deep-space backdrop must stay visible while scrolling');
   assert.equal(staticDepth.beforeAnimation,'none','Distant stars must never animate');
   assert.equal(staticDepth.afterAnimation,'none','Nearby stars must never animate');
   assert.equal(staticDepth.beforeTransform,'none','Distant stars must have zero parallax');
   assert.equal(staticDepth.afterTransform,'none','Nearby stars must have zero parallax');
   assert.match(staticDepth.beforeImage,/stars\.svg/,'Static distant stars must paint');
   assert.match(staticDepth.afterImage,/radial-gradient/,'Static nearby stars must paint');
   assert.equal(staticDepth.far,'','No distant-star scroll offset');
   assert.equal(staticDepth.near,'','No near-star scroll offset');
   assert.match(layout.bodyImage,/radial-gradient/,'Homepage keeps its star field');
   assert.equal(layout.urls.length,3);
   assert.equal(await page.locator('link[rel="preload"][href*="-card"]').count(),3,
    'Product photos should begin loading before the browser reaches card markup');
   // Product images must be real loaded pixels, not only valid-looking src paths.
   await page.waitForFunction(()=>
    [...document.querySelectorAll('#products .product-photo')].length===3
    && [...document.querySelectorAll('#products .product-photo')].every(img=>img.complete && img.naturalWidth>0),
    null,{timeout:12000});
   if(profile.reduced) {
    assert.ok(await page.locator('#products .product-art').evaluateAll(nodes=>
     nodes.every(n=>getComputedStyle(n).opacity==='1')),'Reduced-motion product art is hidden');
   }
   assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0,
    'Static copy should never be concealed or assembled letter by letter');
   assert.ok((await page.locator('#technology h2').textContent()).trim().length>5);
   assert.ok(await page.locator('#products .product-art').evaluateAll(nodes=>nodes.every(n=>
    getComputedStyle(n).opacity==='1'&&getComputedStyle(n).visibility==='visible')),
    'Product artwork must be immediately visible');
   assert.equal(await page.locator('#products article.product').first().locator('.product-art').evaluate(n=>getComputedStyle(n).zIndex),'0');
   const menu=page.locator('#menuBtn');
   if(!profile.reduced)await page.waitForFunction(()=>
    document.querySelector('#navbar')?.dataset.navMotion==='complete',
    null,{timeout:16000});
   await menu.click();
   assert.equal(await menu.getAttribute('aria-expanded'),'true','Mobile menu does not open');
   await page.keyboard.press('Escape');
   assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape does not close menu');
   const headingBefore=await page.locator('#technology h2').textContent();
   await page.locator('#technology').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#technology h2').textContent(),headingBefore);
   assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0);
   const afterScrollDepth=await depthLayer.evaluate(n=>{
    const before=getComputedStyle(n,'::before'),after=getComputedStyle(n,'::after');
    return {
     position:getComputedStyle(n).position,
     beforeAnimation:before.animationName,afterAnimation:after.animationName,
     beforeTransform:before.transform,afterTransform:after.transform,
     beforeImage:before.backgroundImage,afterImage:after.backgroundImage,
     viewportTop:Math.round(n.getBoundingClientRect().top),
     far:n.style.getPropertyValue('--mg-space-far'),
     near:n.style.getPropertyValue('--mg-space-near')
    };
   });
   assert.deepEqual(afterScrollDepth,staticDepth,'Backdrop must remain static on scroll');
   assert.deepEqual(errors,[],'Browser page exceptions');
   assert.deepEqual(writes,[],'Public design made an outbound write');
   await context.close();
   console.log('PASS precision motion matrix',name,profile.width,
    profile.reduced?'reduced/no-WebGL':'instant copy and static background');
  }
 }finally{await browser.close();}
}
