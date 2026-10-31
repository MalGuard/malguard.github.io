// Regression for the CURRENT Precision homepage, not the removed 3D flip-card prototype.
// Covers browser engines, motion preferences, weak-GPU fallback, viewport-gated
// typing, product navigation and layout without contacting external services.
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
   assert.equal(await depthLayer.evaluate(n=>getComputedStyle(n).position),'fixed',
    'Deep-space backdrop must stay visible while scrolling');
   await page.waitForFunction(()=>
    document.querySelector('body.precision-home > .particle-atmosphere')?.dataset.spaceDepth==='ready',
    null,{timeout:5000});
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
   if(!profile.reduced && profile.width===390) {
    const firstCard=page.locator('#products article.product').first();
    // Observe actual typing/visual state transitions before scrolling. The
    // product name must start first, then the cached picture must appear.
    await page.evaluate(()=>{
     const card=document.querySelector('#products article.product');
     const title=card.querySelector('h3[data-type]');
     const art=card.querySelector('.product-art[data-reveal]');
     window.__productRevealOrder=[];
     const observer=new MutationObserver(changes=>{
      for(const change of changes){
       if(change.target===title&&title.dataset.typeState==='typing')
        window.__productRevealOrder.push('title');
       if(change.target===art&&art.dataset.revealState==='active')
        window.__productRevealOrder.push('image');
      }
     });
     observer.observe(title,{attributes:true,attributeFilter:['data-type-state']});
     observer.observe(art,{attributes:true,attributeFilter:['data-reveal-state']});
    });
    const started=Date.now();
    await firstCard.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('#products article.product')].every(card=>
     card.dataset.revealState==='complete'
      && card.querySelector('.product-art')?.dataset.revealState==='complete'
      && card.querySelector('h3')?.dataset.typeState==='complete'),
     null,{timeout:8500});
    assert.ok(Date.now()-started<6500,'Product cards took too long after entering viewport');
    const order=await page.evaluate(()=>window.__productRevealOrder.slice(0,2));
    assert.deepEqual(order,['title','image'],'Product title must render before its image');
    assert.ok(await page.locator('#products .product-art').evaluateAll(nodes=>nodes.every(n=>
     getComputedStyle(n).opacity==='1'&&getComputedStyle(n).visibility==='visible')),
     'All product images should be visible after the fast reveal');
    assert.equal(await firstCard.locator('.product-art').evaluate(n=>getComputedStyle(n).zIndex),'0',
     'Product artwork must have a stable stacking position');
   }
   assert.equal(await page.locator('.hero-actions>a[data-type="button"]').count(),2,
    'Homepage CTAs should be queued as typed actions');
   assert.equal(await page.locator('#navbar .mg-brand[data-type="button"]').count(),1,
    'Header brand should participate in viewport typing');
   const menu=page.locator('#menuBtn');
   if(!profile.reduced)await page.waitForFunction(()=>
    document.querySelector('#navbar')?.dataset.navMotion==='complete',
    null,{timeout:16000});
   await menu.click();
   assert.equal(await menu.getAttribute('aria-expanded'),'true','Mobile menu does not open');
   await page.keyboard.press('Escape');
   assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape does not close menu');
   if(profile.reduced){
    assert.equal(await page.locator('.type-ink').count(),0,'Reduced motion still typed text');
    assert.equal(await page.locator('.type-system').count(),0,'Reduced motion still conceals content');
    assert.ok((await page.locator('#technology h2').textContent()).trim().length>5);
   }else{
    const title=page.locator('#technology [data-type]').first();
    assert.equal(await title.getAttribute('data-type-state'),'pending',
     'Below-fold copy should not type before scrolling');
    await title.evaluate(node=>node.scrollIntoView({behavior:'instant',block:'center'}));
    await page.waitForFunction(()=>
     ['typing','complete'].includes(document.querySelector('#technology [data-type]')?.dataset.typeState),
     null,{timeout:30000});
    assert.ok((await maximumSimultaneousJobsInRegion(page))<=1,
     'Typewriter exceeded one simultaneous item per section');
    await page.waitForFunction(()=>{
     const el=document.querySelector('body.precision-home > .particle-atmosphere');
     return Number.parseInt(el?.style.getPropertyValue('--mg-space-near')||'0',10)>0
      && Number.parseInt(el?.style.getPropertyValue('--mg-space-far')||'0',10)<0;
    },null,{timeout:5000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>
     document.querySelector('body.precision-home > .particle-atmosphere')
      ?.style.getPropertyValue('--mg-space-near')==='0px',null,{timeout:5000});
    await page.waitForFunction(()=>!document.documentElement.classList.contains('type-system'));
    assert.equal(await page.locator('.type-ink').count(),0,
     'Motion-preference update left synthetic text over content');
   }
   assert.deepEqual(errors,[],'Browser page exceptions');
   assert.deepEqual(writes,[],'Public design made an outbound write');
   await context.close();
   console.log('PASS precision motion matrix',name,profile.width,
    profile.reduced?'reduced/no-WebGL':'viewport typing/motion switch');
  }
 }finally{await browser.close();}
}
