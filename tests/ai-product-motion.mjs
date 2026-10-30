import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';

const browser=await chromium.launch(launchOptions('chromium'));
const base='http://127.0.0.1:8790';
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/ai-product.html');
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await page.getByRole('heading',{name:'Android · Samsung'}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Windows'}).count(),1);
  assert.equal(await page.getByText('App not available yet').count(),2);
  assert.equal(await page.locator('.ai-platform-card a[href="/ai/"]').count(),1);
  await page.locator('#mg-report-launcher').waitFor({state:'visible'});
  assert.equal(await page.locator('#mg-report-launcher a').getAttribute('href'),'/report.html?kind=bug');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Platform guide overflows');
  const offscreen=page.locator('.ai-platform-art').last();
  assert.equal(await offscreen.evaluate(node=>getComputedStyle(node).opacity),'0','Offscreen image begins hidden');
  await offscreen.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ai-platform-art')].at(-1)?.dataset.revealState==='complete',null,{timeout:12000});
  assert.equal(await offscreen.evaluate(node=>getComputedStyle(node).opacity),'1');
  assert.deepEqual(errors,[]);await context.close();
 }
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto(base+'/ai-product.html');
 assert.equal(await page.locator('.ai-platform-art').last().evaluate(node=>getComputedStyle(node).opacity),'1');
 await page.close();
 const shared=await browser.newPage({viewport:{width:1280,height:700},reducedMotion:'no-preference'});await shared.goto(base+'/products.html');
 await shared.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
 const title=shared.locator('#malguard-ai h2');assert.equal(await title.getAttribute('data-type-state'),'pending');
 assert.match(await title.locator('.type-source').evaluate(node=>getComputedStyle(node).color),/, 0\)$/,'Shared-page text begins hidden');
 await title.scrollIntoViewIfNeeded();await shared.waitForFunction(()=>document.querySelector('#malguard-ai h2')?.dataset.typeState==='complete',null,{timeout:12000});
 assert.equal(await title.getAttribute('data-type-runs'),'1');await shared.evaluate(()=>scrollTo(0,0));await title.scrollIntoViewIfNeeded();
 assert.equal(await title.getAttribute('data-type-runs'),'1','Returning to a section must not retype it');
 await shared.close();
 for(const route of ['/docs.html','/research/gta-mod-security-fa.html']){
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});await p.goto(base+route);
  await p.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.ok(await p.evaluate(()=>{const n=[...document.querySelectorAll('main [data-type]')].find(x=>x.getBoundingClientRect().top>=innerHeight*.94&&x.dataset.typeState==='pending');if(!n)return false;n.dataset.testViewport='target';return true;}),route+' has pending offscreen content');
  await p.locator('[data-test-viewport="target"]').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForFunction(()=>Number(document.querySelector('[data-test-viewport="target"]')?.dataset.typeRuns)>0,null,{timeout:12000});await p.close();
 }
 const gta=await browser.newPage({reducedMotion:'no-preference'});await gta.goto(base+'/gta6-security.html');
 await gta.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
 assert.equal(await gta.locator('.gta6-type-line[data-type]').count(),3,'GTA VI headline keeps three separately typed lines');await gta.close();
 const fallback=await browser.newPage();await fallback.route('**/assets/precision/site.js*',route=>route.abort());
 await fallback.goto(base+'/ai-product.html');await fallback.waitForFunction(()=>!document.documentElement.classList.contains('type-system'),null,{timeout:8000});
 assert.equal(await fallback.getByRole('heading',{name:'Curiosity, with clarity.'}).isVisible(),true,'Content returns if the motion controller fails');
 await fallback.close();console.log('PASS platform guide, shared-page once-only typing, fallback and reduced motion at mobile and desktop sizes');
}finally{await browser.close();}
