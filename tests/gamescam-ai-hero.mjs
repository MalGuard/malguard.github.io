// Regression: AI logo fusion belongs to the MalGuard intelligence artwork,
// not to Game Scam Guard. Verify real local SVGs, one-shot motion and fallbacks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';

const typing=readFileSync('assets/precision/site.js','utf8');
assert.match(typing,/per:29,min:230,max:455/,'button timing must remain stable');
assert.match(typing,/per:39,min:335,max:900/,'heading timing must remain stable');
assert.match(typing,/per:21,min:360,max:1320/,'body timing must remain stable');

const base='https://127.0.0.1:8443';
const browserName=process.env.TEST_BROWSER||'chromium';
const browser=await(browserName==='webkit'?webkit:chromium).launch(launchOptions(browserName));
async function checkScene(page,selector,reduced){
  const stage=page.locator(selector);
  assert.equal(await stage.count(),1,'missing AI scene: '+selector);
  await stage.scrollIntoViewIfNeeded();
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
      selector,{timeout:6000});
    const a=await stage.locator('.mg-ai-fusion__mark').first().evaluate(x=>getComputedStyle(x).animationName);
    assert.equal(a,'mg-ai-hop-and-fuse');
  }
}
try{
  for(const width of [390,1280]){
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    const page=await ctx.newPage();
    for(const [path,selector] of [
      ['/','main .product-ai .mg-ai-fusion'],
      ['/products.html','main .product-ai .mg-ai-fusion'],
      ['/threat-radar.html','.radar-ai-illustration.mg-ai-fusion']
    ]){
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
      assert.equal(response?.status(),200,path);
      await checkScene(page,selector,true);
    }
    await page.goto(base+'/game-scam-guard.html',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.mg-card-hero--scam').count(),1);
    assert.equal(await page.locator('.mg-card-hero--scam [src*="provider-"]').count(),0,
      'Game Scam Guard must retain its own artwork, not AI provider logos');
    console.log('PASS no-motion and Game Scam separation',browserName,width);
    await ctx.close();
  }
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900},reducedMotion:'no-preference'});
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page=await ctx.newPage();
  await page.goto(base+'/threat-radar.html',{waitUntil:'domcontentloaded'});
  await checkScene(page,'.radar-ai-illustration.mg-ai-fusion',false);
  // Advance animations instead of making CI wait for a full 4.5-second cycle.
  const final=await page.locator('.radar-ai-illustration.mg-ai-fusion').evaluate(el=>{
    for(const a of el.getAnimations()){a.finish()}
    const brand=el.querySelector('.mg-ai-fusion__brand');
    return{
      opacity:getComputedStyle(brand).opacity,
      marks:[...el.querySelectorAll('.mg-ai-fusion__mark')].map(x=>getComputedStyle(x).opacity)
    };
  });
  assert.equal(final.opacity,'1','MalGuard must be visible at the end');
  assert.ok(final.marks.every(x=>x==='0'),'the three provider marks must disappear');
  console.log('PASS one-shot fusion',browserName);
  await ctx.close();
}finally{await browser.close()}
