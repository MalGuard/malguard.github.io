// Platform guide and public editorial pages expose copy/art without typing.
import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const browser=await chromium.launch(launchOptions('chromium'));
const base='http://127.0.0.1:8790';
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/ai-product.html');
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await page.getByRole('heading',{name:'Android · Samsung'}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Windows'}).count(),1);
  assert.equal(await page.getByText('App not available yet').count(),2);
  assert.equal(await page.locator('.ai-platform-card a[href="/ai/"]').count(),1);
  await page.locator('#mg-report-launcher').waitFor({state:'visible'});
  assert.equal(await page.locator('#mg-report-launcher a').getAttribute('href'),'/report.html?kind=bug');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0);
  assert.equal(await page.locator('.ai-platform-art').last().evaluate(n=>getComputedStyle(n).opacity),'1');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 for(const route of ['/products.html','/docs.html','/research/gta-mod-security-fa.html']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base+route);
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  const title=page.locator('main h1').first(),copy=await title.textContent();
  assert.ok(copy.trim().length>5,route);
  assert.equal(await page.locator('html.type-system,.type-ink,.type-cursor').count(),0,route);
  await title.scrollIntoViewIfNeeded();
  assert.equal(await title.textContent(),copy);
  await page.close();
 }
 const gta=await browser.newPage();await gta.goto(base+'/gta6-security.html');
 assert.equal(await gta.locator('.gta6-type-line').count(),3,'GTA VI title lines remain visible');await gta.close();
 const fallback=await browser.newPage();
 await fallback.route('**/assets/precision/site.js*',route=>route.abort());
 await fallback.goto(base+'/ai-product.html');
 assert.equal(await fallback.getByRole('heading',{name:'Curiosity, with clarity.'}).isVisible(),true,
  'HTML copy must remain visible without the optional instant-copy script');
 await fallback.close();
 console.log('PASS AI platform guide, instant shared copy and script fallback');
}finally{await browser.close();}
