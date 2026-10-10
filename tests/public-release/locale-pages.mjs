import assert from 'node:assert/strict';
import {chromium}from '../browser-runtime.mjs';
import {readFile,writeFile}from 'node:fs/promises';
const paths=['/','/products.html','/tools.html','/scan-url.html','/gta-guard.html','/ai-intelligence.html','/malware-ai.html','/malware-ai-windows.html','/scan-mods.html','/download.html','/app.html','/trust.html','/privacy.html','/about.html','/founder.html','/docs.html','/labs.html','/support.html','/sandbox-help.html','/ios-preview/','/research/repackaged-mod.html','/404.html','/game-scam-guard.html','/research/security-motion.html','/release/sandbox-help-historical.html'];
const browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const results=[];
try{
 for(const width of [320,1280]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin==='https://127.0.0.1:8443'?r.continue():r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://127.0.0.1:8443/#admin-access');
  await page.waitForSelector('#siteEntryGate:not([hidden])');
  await page.locator('.site-entry-shell .mg-language select').selectOption('fa');
  assert.ok((await page.locator('.site-entry-step h1').first().innerText()).match(/[\u0600-\u06ff]/));
  await page.locator('#sitePublicEntry').click();
  for(const path of paths){
   const start=errors.length;await page.goto('https://127.0.0.1:8443'+path);
   await page.waitForFunction(()=>document.documentElement.lang==='fa');
   assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
   assert.ok(await page.locator('h1').count());
   const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   assert.ok(dimensions.width<=dimensions.client+1,JSON.stringify({path,width,dimensions}));
   assert.deepEqual(errors.slice(start),[],path);
   results.push({path,width,passed:true});
  }
  await context.close();
 }
 console.log('PASS: '+results.length+' Persian/RTL page layouts and locale persistence checks; public/admin entry remains separate.');
 await writeFile('test-results/persian-pages.json',JSON.stringify({checks:results,passed:results.length,failed:0},null,2));
}finally{await browser.close();}
