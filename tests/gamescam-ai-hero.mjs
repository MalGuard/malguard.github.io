// Regression: AI logo fusion belongs to the MalGuard intelligence artwork,
// not to Game Scam Guard. Verify real local SVGs, one-shot motion and fallbacks.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';

const typing=readFileSync('assets/precision/site.js','utf8');
assert.match(typing,/per:29,min:230,max:455/,'button timing must remain stable');
assert.match(typing,/per:39,min:335,max:900/,'heading timing must remain stable');
assert.match(typing,/per:21,min:360,max:1320/,'body timing must remain stable');

assert.match(readFileSync('assets/precision/provider-claude.svg','utf8'),/fill="#D97757"/,'Claude mark must retain its terracotta brand color');
const base='https://127.0.0.1:8443';
const browserName=process.env.TEST_BROWSER||'chromium';
const browser=await(browserName==='webkit'?webkit:chromium).launch(launchOptions(browserName));
const scenes=[
  ['/','main .product-ai .mg-ai-fusion'],
  ['/products.html','main .product-ai .mg-ai-fusion'],
  ['/threat-radar.html','.radar-ai-illustration.mg-ai-fusion']
];
async function checkScene(page,selector,reduced){
  const stage=page.locator(selector);
  assert.equal(await stage.count(),1,'missing AI scene: '+selector);
  // Other page copy types while the artwork plays. Do not wait for the moving
  // hero's layout to settle before observing this short natural animation.
  await stage.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
  await page.waitForFunction(sel=>{
    const el=document.querySelector(sel);
    return !!el&&[...el.querySelectorAll('img')].length===4&&
      [...el.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0);
  },selector,{timeout:15000});
  const scene=await stage.evaluate(el=>{
    const marks=[...el.querySelectorAll('.mg-ai-fusion__mark')];
    const brand=el.querySelector('.mg-ai-fusion__brand');
    return{
      marks:marks.length,
      sources:marks.map(x=>x.querySelector('img')?.getAttribute('src')),
      final:brand?.querySelector('img')?.getAttribute('src'),
      active:el.dataset.fusionActive,
      markAnimations:marks.map(x=>getComputedStyle(x).animationName),
      brandAnimation:getComputedStyle(brand).animationName,
      brandOpacity:getComputedStyle(brand).opacity,
      markOpacity:marks.map(x=>getComputedStyle(x).opacity),
      noBoxes:marks.every(x=>{
        const s=getComputedStyle(x);
        return s.borderTopStyle==='none'&&s.backgroundImage==='none'&&
          (s.backgroundColor==='rgba(0, 0, 0, 0)'||s.backgroundColor==='transparent')&&s.boxShadow==='none';
      })
    };
  });
  assert.equal(scene.marks,3);
  assert.deepEqual(scene.sources,
    ['openai','claude','grok'].map(x=>'/assets/precision/provider-'+x+'.svg'));
  assert.equal(scene.final,'/assets/fusion/assets/malguard-logo.svg');
  assert.ok(scene.noBoxes,'brandmarks must not have card backgrounds');
  if(reduced){
    assert.equal(scene.brandAnimation,'none');
    assert.equal(scene.brandOpacity,'1');
    assert.ok(scene.markOpacity.every(x=>x==='0'),'reduced motion must not show incoming marks');
  }else{
    await page.waitForFunction(sel=>document.querySelector(sel)?.dataset.fusionActive==='true',
      selector,{timeout:20000});
    const a=await stage.locator('.mg-ai-fusion__mark').first().evaluate(x=>getComputedStyle(x).animationName);
    assert.equal(a,'mg-ai-hop-and-fuse');
  }
}
try{
  for(const width of [360,390,768,1280]){
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await ctx.newPage();
    for(const [path,selector] of scenes){
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
      assert.equal(response?.status(),200,path);
      await checkScene(page,selector,true);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),path+' overflow @'+width);
    }
    await page.goto(base+'/game-scam-guard.html',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.mg-card-hero--scam').count(),1);
    assert.equal(await page.locator('.mg-card-hero--scam [src*="provider-"]').count(),0,
      'Game Scam Guard must retain its own artwork, not AI provider logos');
    console.log('PASS no-motion and Game Scam separation',browserName,width);
    await ctx.close();
  }
  // Returning to normal motion must not replay a one-shot scene. Cover both
  // an active scene and a below-fold scene waiting on IntersectionObserver.
  for(const [path,selector] of [scenes[0],scenes[2]]){
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,reducedMotion:'no-preference'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await ctx.newPage();
    await page.goto(base+path,{waitUntil:'domcontentloaded'});
    if(path!=='/')await checkScene(page,selector,false);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(sel=>!document.querySelector(sel).hasAttribute('data-fusion-ready'),selector);
    await checkScene(page,selector,true);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await checkScene(page,selector,true);
    await page.waitForTimeout(200);
    assert.equal(await page.locator(selector).evaluate(el=>el.getAnimations({subtree:true}).length),0,'motion preference update replayed the composition');
    console.log('PASS live reduced-motion change without replay',browserName,path);
    await ctx.close();
  }
  for(const width of [360,390,768,1280]){
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,javaScriptEnabled:false,viewport:{width,height:900}});
    const page=await ctx.newPage();
    for(const [path,selector] of scenes){
      await page.goto(base+path,{waitUntil:'load'});
      await checkScene(page,selector,true);
    }
    console.log('PASS no-JavaScript final brand',browserName,width);
    await ctx.close();
  }
  mkdirSync('test-results',{recursive:true});
  for(const width of [360,390,768,1280]){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'no-preference'});
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const [path,selector] of scenes){
  await page.goto(base+path,{waitUntil:'domcontentloaded'});
  await checkScene(page,selector,false);
  const stage=page.locator(selector);
  const bounds=await stage.evaluate(el=>({width:el.offsetWidth,height:el.offsetHeight}));
  assert.equal(await stage.locator('.mg-ai-fusion__mark').first().evaluate(el=>getComputedStyle(el).animationDuration),'7.2s');
  // WebKit does not consistently apply CSS animation fill state after
  // Web Animations API .finish(); verify the real elapsed end state instead.
  await page.waitForFunction(sel=>document.querySelector(sel).getAnimations({subtree:true}).every(a=>a.playState==='finished'),selector);
  const final=await stage.evaluate(el=>{
    const brand=el.querySelector('.mg-ai-fusion__brand');
    return{
      opacity:getComputedStyle(brand).opacity,
      marks:[...el.querySelectorAll('.mg-ai-fusion__mark')].map(x=>getComputedStyle(x).opacity)
    };
  });
  assert.equal(final.opacity,'1','MalGuard must be visible at the end');
  assert.ok(final.marks.every(x=>x==='0'),'the three provider marks must disappear');
  assert.deepEqual(await stage.evaluate(el=>({width:el.offsetWidth,height:el.offsetHeight})),bounds,'animation changed artwork layout');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),path+' overflow @'+width);
  await stage.evaluate(el=>el.scrollIntoView({block:'start'}));
  assert.equal(await stage.locator('.mg-ai-fusion__brand').evaluate(el=>getComputedStyle(el).opacity),'1','scroll replayed fusion');
  // After verifying the untouched natural end state, seek the completed
  // animation to its rest pose for deterministic geometry and visual review.
  // Driver/layout waits can otherwise miss that interval on these typed pages.
  const rest=await stage.evaluate(async el=>{
    for(const animation of el.getAnimations({subtree:true})){
      animation.pause();animation.currentTime=3200;
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=el.getBoundingClientRect();
    let painted=true;
    for(let p=el;p;p=p.parentElement)if(Number(getComputedStyle(p).opacity)<.9)painted=false;
    return {painted,marks:[...el.querySelectorAll('.mg-ai-fusion__mark')].map(mark=>{
      const m=mark.getBoundingClientRect();
      return Number(getComputedStyle(mark).opacity)>.9&&m.left>=r.left&&m.right<=r.right&&m.top>=r.top&&m.bottom<=r.bottom;
    })};
  });
  assert.ok(rest.painted&&rest.marks.every(Boolean),'settled provider marks must be painted and unclipped '+path+' @'+width+' '+JSON.stringify(rest));
  await stage.screenshot({path:`test-results/fusion-${browserName}-${width}-${path==='/'?'home':path.slice(1,-5)}.png`});
  console.log('PASS natural slow fusion, unclipped marks and stable layout',browserName,width,path);
  }
  assert.deepEqual(errors,[],'page exceptions');
  await ctx.close();
  }
}finally{await browser.close()}
