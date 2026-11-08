// User-visible regression: content remains usable when motion or scripts are absent.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base=process.env.TEST_BASE_URL||'https://127.0.0.1:8443';
assert.ok(['https://127.0.0.1:8443','http://127.0.0.1:8085'].includes(base));
const name=process.env.TEST_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(name));
const browser=await (name==='chromium'?chromium:webkit).launch(launchOptions(name));
await mkdir('test-results',{recursive:true});
try{
 for(const width of [320,390,820,1440])for(const reducedMotion of ['reduce','no-preference']){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.getByRole('link',{name:'Explore products',exact:true}).isVisible());
  assert.ok(await page.locator('h1').isVisible());
  assert.equal(await page.locator('.type-ink').count(),0);
  assert.equal(await page.locator('#products article').count(),4);
  await page.locator('#products').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('#products img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.ok(await page.locator('#products .product-art').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='visible'&&Number(getComputedStyle(n).opacity)===1)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('#products canvas').count(),0);
  if(reducedMotion==='reduce')assert.equal(await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.locator('#menuBtn').click();assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'false');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>scrollTo(0,0));
  // Playwright may wait indefinitely for a stalled optional @font-face request
  // even though the semantic, layout and interaction assertions above passed.
  // Preserve screenshots when fonts resolve, without treating an unavailable
  // font resource as a content/application failure.
  try{await page.screenshot({path:`test-results/instant-${name}-${width}-${reducedMotion}.png`,fullPage:true,timeout:12000});}
  catch(error){if(!/waiting for fonts to load/i.test(String(error?.message||'')))throw error;console.warn('Optional screenshot skipped: font loading did not settle',name,width,reducedMotion);}
  await context.close();
 }
 const context=await browser.newContext({ignoreHTTPSErrors:true,javaScriptEnabled:false,viewport:{width:390,height:844}});
 const page=await context.newPage();await page.goto(base+'/');
 assert.ok(await page.getByRole('link',{name:'Explore products',exact:true}).isVisible());
 await page.locator('#products').scrollIntoViewIfNeeded();
 assert.ok(await page.locator('#products .product-art').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='visible'&&Number(getComputedStyle(n).opacity)===1)));
 await context.close();console.log('PASS: immediate content, artwork, navigation, reduced motion, JS-free and responsive layouts');
}finally{await browser.close();}
