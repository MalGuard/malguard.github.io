// Production-layout browser regression for the approved lightweight homepage.
// The old GPU card-flip/camera handoff was intentionally retired; do not require it.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';

const base='https://127.0.0.1:8443';
const names=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
const products=['/gta-guard.html','/game-scam-guard.html','/threat-radar.html'];
const stages=['Identify','Inspect','Analyze','Decide'];
const reports=[];
await mkdir('test-results/precision-motion',{recursive:true});
for(const name of names){
 assert.ok(['chromium','webkit'].includes(name),'Invalid browser');
 const browser=await (name==='chromium'?chromium:webkit).launch(launchOptions(name));
 try{
  for(const [width,height] of [[320,780],[390,844],[820,1000],[1440,900]]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   const page=await context.newPage(),errors=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url())});
   assert.equal((await page.goto(base+'/')).status(),200);
   await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
   await page.waitForFunction(()=>document.querySelector('.flow-stage')?.dataset.renderer==='vector');
   assert.equal(await page.locator('main h1').count(),1);
   assert.equal(await page.locator('#products article.product').count(),3);
   assert.equal(await page.locator('#products canvas').count(),0,'Product cards must not require GPU');
   assert.deepEqual(await page.locator('#products a.text-link').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname)),products);
   assert.deepEqual((await page.locator('#technology .principles li h3').allTextContents()).map(s=>s.trim()),stages);
   assert.equal(await page.locator('#technology canvas').count(),0,'Security flow needs SVG fallback');
   assert.equal(await page.locator('main .type-ink').count(),0,'Reduced-motion copy must not animate');
   for(const y of [0,.25,.5,.75,1]){
    await page.evaluate(f=>scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*f,behavior:'instant'}),y);
    await page.waitForTimeout(45);
    const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(size.scroll<=size.client+1,'Horizontal overflow at '+width+'px, scroll '+y);
   }
   await page.locator('#products').scrollIntoViewIfNeeded();
   for(const image of await page.locator('#products .product-photo').all()){
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(el=>el.decode?.().catch(()=>{}));
    assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0),'Product artwork must load');
   }
   assert.deepEqual(errors,[],'No homepage JS runtime exceptions');
   assert.deepEqual(writes,[],'Homepage must not send unintended writes');
   if([390,1440].includes(width))
    await page.screenshot({path:`test-results/precision-motion/${name}-${width}.png`,fullPage:true});
   reports.push({browser:name,width,layout:'pass',productLinks:products,stages,images:'loaded',errors});
   console.log('PASS',name,width,'precision homepage geometry, images, navigation and no-GPU flow');
   await context.close();
  }
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:850},reducedMotion:'no-preference'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/');
  await p.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  const target=p.locator('#technology [data-type]').first();
  assert.equal(await target.getAttribute('data-type-state'),'pending','Offscreen text starts only when viewed');
  await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await p.waitForFunction(()=>Number(document.querySelector('#technology [data-type]')?.dataset.typeRuns)>0,null,{timeout:12000});
  assert.ok(await p.locator('main [data-type-state=typing]').count()<=1,'One active typewriter');
  assert.deepEqual(errors,[],'Typewriter must not throw');
  reports.push({browser:name,viewportTyping:'pass',errors});
  console.log('PASS',name,'viewport-triggered sequential typewriter');
  await c.close();
 }finally{await browser.close();}
}
await writeFile('test-results/precision-motion/summary.json',JSON.stringify({status:'PASS',reports},null,2));
