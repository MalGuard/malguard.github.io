const {chromium,webkit}=require('./qa-runtime.cjs').playwright,assert=require('assert'),fs=require('fs');
const base=require('path').resolve(__dirname,'../../test-results/fusion');let browser;fs.mkdirSync(base,{recursive:true});
(async()=>{
 const wk=process.argv[2]==='webkit';browser=await(wk?webkit:chromium).launch(wk?{headless:!process.env.DISPLAY}:require('./qa-runtime.cjs').chromiumLaunch);const reports=[];
 for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['zoom-short',360,225]]){
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width,height},hasTouch:label!=='desktop',isMobile:label!=='desktop'}),errors=[],writes=[];await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(require('./qa-runtime.cjs').siteURL).origin?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url())});
  await page.goto(require('./qa-runtime.cjs').siteURL);await page.waitForFunction(()=>document.body.dataset.intro==='ready',null,{timeout:15000});
  const initial=await page.evaluate(()=>({logo:document.getElementById('c').dataset.logoReady,lowerVisible:document.getElementById('products').classList.contains('vis'),textBackground:getComputedStyle(document.querySelector('.scene .t')).backgroundColor}));assert.equal(initial.lowerVisible,false);assert.equal(initial.textBackground,'rgba(0, 0, 0, 0)');
  // Walk the complete page with native scrolling, including every sticky range.
  const full=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);let maxOverflow=0;
  for(let y=0;y<=full;y+=height*.65){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(25);maxOverflow=Math.max(maxOverflow,await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}assert(maxOverflow<=1,'full scroll overflow');
  const layer=await page.locator('#layers').evaluate(e=>({top:e.offsetTop,len:e.offsetHeight-e.querySelector('.sticky').offsetHeight,flow:e.classList.contains('flow-mode')}));const layerSteps=[];
  if(!layer.flow)for(const progress of [.07,.34,.62,.91]){await page.evaluate(({layer,progress})=>scrollTo({top:layer.top+layer.len*progress,behavior:'instant'}),{layer,progress});await page.waitForFunction(active=>document.getElementById('layers').dataset.activeLayer===String(active),Math.floor(progress*4),{timeout:10000});const s=await page.locator('#layers').evaluate(e=>({top:e.querySelector('.sticky').getBoundingClientRect().top,active:[...e.querySelectorAll('.st')].findIndex(s=>s.classList.contains('act'))}));assert(Math.abs(s.top)<2,'Four Layers no longer pinned');layerSteps.push(s.active);}
  if(!layer.flow)assert.deepEqual(layerSteps,[0,1,2,3]);
  const card=page.locator('.card').nth(1);await card.scrollIntoViewIfNeeded();await page.waitForTimeout(900);if(label==='desktop')await card.locator('.front .mg-card-control').click();else await card.locator('.front .mg-card-control').tap();assert.equal(await card.getAttribute('data-flipped'),'true');await page.waitForTimeout(600);if(label==='desktop')await card.locator('.back .mg-card-control').click();else await card.locator('.back .mg-card-control').tap();assert.equal(await card.getAttribute('data-flipped'),'false');
  await page.locator('#picks button[data-i="3"]').click();await page.waitForFunction(()=>document.getElementById('vt').textContent==='Inconclusive',null,{timeout:10000});
  // The back includes a genuine navigation link. Target its separate return
  // control, not the card's center (which can hit that link in WebKit).
  const gta=page.locator('.card').first();await gta.scrollIntoViewIfNeeded();await page.waitForTimeout(600);await gta.locator('.front .mg-card-control').click();assert.equal(await gta.getAttribute('data-flipped'),'true');await page.waitForTimeout(700);await gta.locator('.back .mg-card-control').click();assert.equal(await gta.getAttribute('data-flipped'),'false');assert.equal(page.url(),require('./qa-runtime.cjs').siteURL);
  assert.equal(await page.locator('.card').first().locator('.product-entry').getAttribute('href'),'/gta-guard.html');
  assert.equal(await page.locator('#device-story').count(),0);
  await page.locator('#finale').scrollIntoViewIfNeeded();await page.waitForFunction(()=>Number(document.getElementById('c').dataset.scene)>12.97,null,{timeout:15000});
  assert.equal(await page.locator('#c').getAttribute('data-form'),'MalGuard');assert.equal(await page.locator('#c').getAttribute('data-logo-ready'),'true');
  await page.screenshot({path:`${base}/gta-fusion-regression-${wk?'webkit':'chromium'}-${label}-finale.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);reports.push({label,initial,fullScroll:true,maxOverflow,layerSteps,cardFlip:true,inconclusiveChamber:true,originalGtaCardFlip:true,rejectedLaptopRemoved:true,authenticFinalLogo:true,noNetworkWrites:true,errors});console.log('PASS whole page '+(wk?'WebKit':'Chromium')+' '+label);await page.close();
 }
 await browser.close();fs.writeFileSync(`${base}/gta-fusion-regression-${wk?'webkit':'chromium'}.json`,JSON.stringify(reports,null,2));
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exit(1)});
