// Verify Game Scam Guard responsive brandmark illustration with immediate content.
// Local HTTPS only. Branding is a visual illustration, never proof of vendor integration.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const root='https://127.0.0.1:8443',browserName=process.env.TEST_BROWSER||'chromium';
const releasePath='/release/gamescam-guard-android.json';
const release=JSON.parse(await readFile(new URL('..'+releasePath,import.meta.url),'utf8'));
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
  await page.locator('#game-scam-title').waitFor({state:'visible'});
  assert.equal(await page.locator('main h1').count(),1);
  assert.match(await page.locator('.mg-card-hero--scam').innerText(),/cannot guarantee safety/);
  assert.deepEqual(await page.locator('main a[download]').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),[release.url,release.url]);
  assert.equal(await page.locator('.scam-hero-actions a').last().getAttribute('href'),'/game-scam-guard/');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('.scam-model-mark').count(),0,'Do not imply unconnected provider integrations');
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS widened copy and staggered logo trio',browserName,width);
  if(width===390){
   await page.goto(root+'/gamescam-guard-android.html#updates');
   const downloadLink=page.locator('.android-release-link');
   const downloadPath=await downloadLink.getAttribute('href');
   assert.equal(downloadPath,release.url);
   assert.notEqual(await downloadLink.getAttribute('download'),null);
   const response=await page.request.get(root+downloadPath);
   assert.equal(response.status(),200);
   assert.equal(new URL(response.url()).pathname,'/release/'+release.filename);
   const apk=await response.body();
   assert.equal(apk.length,release.size);
   assert.equal(createHash('sha256').update(apk).digest('hex'),release.sha256);

   const form=page.locator('#android-version-form');
   const input=form.getByRole('textbox');
   const result=form.getByRole('status');
   await input.press('Enter');
   assert.equal(await input.evaluate(field=>field.validity.valueMissing),true);
   assert.equal(await result.textContent(),'');
   const check=async (code,english)=>{
    await input.fill(code);
    await input.press('Enter');
    await result.filter({hasText:english}).waitFor({state:'visible'});
   };
   await check('  '+release.releaseCode.toLowerCase()+'  ',`Up to date (${release.version})`);
   await check('GSG-ANDROID-1.1.0-FA09663',`Update available (1.1.0 → ${release.version})`);
   await check('GSG-ANDROID-UNKNOWN','Unknown release code');
   await page.route(root+releasePath,route=>route.fulfill({status:503}));
   await check(release.releaseCode,'Could not check the version');
   await page.unroute(root+releasePath);
   await check(release.releaseCode,`Up to date (${release.version})`);
   assert.deepEqual(errors,[],'Android release page errors');
   console.log('PASS Android APK download, version status and metadata error recovery',browserName);
  }
  if(process.env.GSG_QA_SCREENSHOTS && width!==820){
   await page.goto(root+'/gamescam-guard-android.html#updates');
   await page.locator('#android-version-code').waitFor({state:'visible'});
   await page.screenshot({path:`${process.env.GSG_QA_SCREENSHOTS}/android-${browserName}-${width}.png`});
  }
  await context.close();
 }
}finally{await browser.close()}
