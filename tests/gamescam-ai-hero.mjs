// Verify Game Scam Guard responsive brandmark illustration and site-wide typing speed.
// Local HTTPS only. Branding is a visual illustration, never proof of vendor integration.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const js=readFileSync('assets/precision/site.js','utf8');
assert.match(js,/per:29,min:230,max:455/,'button timing should be slightly faster');
assert.match(js,/per:39,min:335,max:900/,'title timing should be slightly faster');
assert.match(js,/per:21,min:360,max:1320/,'body timing should be slightly faster');
const root='https://127.0.0.1:8443',browserName=process.env.TEST_BROWSER||'chromium';
const browser=await(browserName==='webkit'?webkit:chromium).launch(launchOptions(browserName));
try{
 for(const width of [390,820,1280]){
  const context=await browser.newContext({
   ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'
  });
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(root).origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const r=await page.goto(root+'/game-scam-guard.html',{waitUntil:'domcontentloaded'});
  assert.equal(r?.status(),200,'missing Game Scam Guard page');
  await page.waitForFunction(()=>[...document.querySelectorAll('.scam-model-mark img')].length===3&&[...document.querySelectorAll('.scam-model-mark img')].every(im=>im.complete&&im.naturalWidth>0),null,{timeout:12000});
  const assets=await page.locator('.scam-model-mark img').evaluateAll(imgs=>imgs.map(im=>({
   src:im.getAttribute('src'),loaded:im.complete&&im.naturalWidth>0
  })));
  assert.equal(assets.length,3,'expected three illustrated provider marks');
  for(const asset of assets){
   assert.match(asset.src,/^\/assets\/precision\/provider-(openai|claude|grok)\.svg$/);
   assert.ok(asset.loaded,'provider brandmark did not load locally '+asset.src);
  }
  const data=await page.evaluate(()=>{
   const hero=document.querySelector('.mg-card-hero--scam');
   const comp=hero.querySelector('.scam-model-composition');
   const copy=hero.querySelector('.scam-hero-copy');
   const logos=[...comp.querySelectorAll('.scam-model-mark')];
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
   return{
    hero:rect(hero),copy:rect(copy),visual:rect(comp),marks:logos.map(rect),
    heading:document.querySelectorAll('main h1').length,
    bg:getComputedStyle(hero,'::before').backgroundImage,
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
    disclaim:comp.getAttribute('aria-label'),
    faster:[...document.scripts].some(x=>x.src.includes('site.js?v=slightly-faster-typing-20261022'))
   };
  });
  assert.ok(data.faster,'missing fresh typewriter JS version');
  assert.ok(data.bg.includes('scam-card-960.webp'),'previous card photo must remain');
  assert.equal(data.heading,1,'hero title duplicated');
  assert.ok(data.disclaim.includes('not a claim of integration'),'illustration must not claim integration');
  assert.ok(data.scroll<=data.viewport+2,'horizontal scroll overflow at '+width);
  assert.ok(data.marks.every(x=>x.w>=(width<530?108:142)),'logos not enlarged enough');
  assert.ok(data.marks[0].y<data.marks[1].y&&data.marks[1].y<data.marks[2].y,
   'logos should stagger downward ChatGPT to Claude to Grok');
  if(width>=941){
   assert.ok(data.copy.w>480,'copy should extend into previously unused hero width');
   assert.ok(data.visual.x>=data.copy.right-10,'logos overlap hero text');
  }else assert.ok(data.visual.y>=data.copy.bottom-3,'mobile/tablet logos should follow the copy');
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS widened copy and staggered logo trio',browserName,width);
  await context.close();
 }
}finally{await browser.close()}
