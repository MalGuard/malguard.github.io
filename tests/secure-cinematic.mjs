import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base=process.env.MALGUARD_FORM_QA_URL||'https://127.0.0.1:8443';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
const reports=[];await mkdir('test-results/secure-cinematic',{recursive:true});
let activePage,activeProfile;
async function clickSettled(page,selector){
 const button=page.locator(selector);await button.focus();await button.scrollIntoViewIfNeeded();
 // Focus and phone blur can scroll/reflow the narrow animated form. Observe the
 // actual hit box before pointer activation; never retry a possibly lost submit.
 await page.evaluate(selector=>new Promise((resolve,reject)=>{
  const started=performance.now();let previous='',stableSince=started;
  function frame(now){
   const r=document.querySelector(selector).getBoundingClientRect();
   const position=[scrollX,scrollY,r.x,r.y,r.width,r.height].join(',');
   if(position!==previous){previous=position;stableSince=now;}
   if(now-stableSince>=160)return resolve();
   if(now-started>5000)return reject(new Error('Button did not settle before pointer activation'));
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 }),selector);
 await button.click();
}
for(const engine of engines){
 const browser=await({chromium,webkit}[engine]).launch({...launchOptions(engine),...(engine==='webkit'&&process.env.DISPLAY?{headless:false}:{})});
 try{
  for(const [width,height]of [[320,740],[820,1180],[1440,900]]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height},reducedMotion:'no-preference'});
   const errors=[],external=[],auth=[];let allow=false,releaseAuth;
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin===new URL(base).origin)return route.continue();
    if(url.origin==='https://malware-ai-gray.vercel.app'&&url.pathname==='/api/auth'){
     const headers={'access-control-allow-origin':base,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'};
     if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
     auth.push(JSON.parse(req.postData()));if(auth.length===1)await new Promise(resolve=>{releaseAuth=resolve;});
     return route.fulfill({status:allow?200:401,headers,contentType:'application/json',body:JSON.stringify(allow?{ok:true}:{error:'Access denied'})});
    }external.push(req.url());return route.abort();
   });
   const page=await context.newPage();activePage=page;activeProfile={engine,width,height};page.on('pageerror',e=>errors.push(e.message));
   for(const path of ['/report.html','/console-8d42b69fda13705cc47a.html']){
    await page.goto(base+path);if(path==='/report.html'){await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');assert.equal(await page.locator('#secure-scene,#secure-field,#secure-volume').count(),0);assert(await page.locator('#reportSubmit').isEnabled());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));continue;}await page.waitForFunction(()=>window.MalGuardSecureMotion);await page.waitForTimeout(1100);
    assert.equal(await page.locator('#secure-field,#secure-volume,canvas').count(),0);
    assert(await page.evaluate(()=>MalGuardSecureMotion.snapshot().activeAnimations>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
    const title=await page.locator('.secure-story h1').boundingBox(),nav=await page.locator('#navbar').boundingBox();assert(title.y>=nav.y+nav.height);
    const language=page.locator('.mg-language select').first();await language.selectOption('fa');await page.waitForFunction(()=>document.documentElement.dir==='rtl'&&document.querySelector('.secure-start span').textContent.startsWith('شروع'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));await language.selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('.secure-start span').textContent.startsWith('Start'));
    await page.locator('.secure-start').focus();await page.keyboard.press('Enter');
    await page.locator('#motionToggle').press('Enter');await page.waitForFunction(()=>MalGuardSecureMotion.snapshot().paused===true);
    assert.equal(await page.locator('.vault-slab').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await page.waitForFunction(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).every(a=>a.playState==='paused'&&!a.pending));
    const frozen=await page.evaluate(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).map(a=>a.currentTime));await page.waitForTimeout(120);
    assert.deepEqual(await page.evaluate(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).map(a=>a.currentTime)),frozen);
    await clickSettled(page,'#motionToggle');await page.waitForFunction(()=>MalGuardSecureMotion.snapshot().paused===false);
    // Motion was verified above; freeze only while capturing a static image.
    await page.screenshot({path:`test-results/secure-cinematic/${path.includes('console')?'admin':'report'}-${engine}-${width}.png`,fullPage:true,animations:'disabled'});
   }
   await page.locator('#siteAdminPassword').focus();let reached=false;for(let i=0;i<10;i++){await page.keyboard.press('Shift+Tab');if(await page.locator('.secure-start').evaluate(el=>el===document.activeElement)){reached=true;break;}}assert(reached,'Start must be reachable through the administrator focus loop');await page.keyboard.press('Enter');
   await page.locator('#siteAdminPassword').fill('synthetic-password');assert.match(await page.locator('#passwordSignal').textContent(),/^•+$/);
   assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'password');
   await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.body.dataset.secureState==='checking');
   assert.equal(await page.locator('.secure-panel').getAttribute('aria-busy'),'true');assert.equal(auth.length,1);releaseAuth();
   await page.waitForFunction(()=>document.body.dataset.secureState==='error');assert.equal(await page.locator('#siteAdminIdentityStep').isVisible(),false);
   allow=true;await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.body.dataset.secureState==='identity');assert(await page.locator('#siteAdminIdentityStep').isVisible());assert.equal(await page.locator('#passwordSignal').textContent(),'');
   // Observe native submit delivery as well as the resulting error. This catches
   // a lost pointer activation even when an earlier error remains on the page.
   await page.evaluate(()=>{window.__adminIdentitySubmits=0;document.getElementById('siteAdminIdentityForm').addEventListener('submit',()=>window.__adminIdentitySubmits++,true);});
   await page.locator('#siteAdminConsent').check();assert.equal(await page.locator('#siteAdminConsent').isChecked(),true);
   await page.locator('#siteAdminName').fill('x');await page.locator('#siteAdminPhone').fill('2025550148');await page.locator('#siteAdminEnter').press('Enter');await page.waitForFunction(()=>document.body.dataset.secureState==='error'&&document.getElementById('siteAdminIdentityError').textContent==='Enter your name before continuing.');assert.equal(await page.evaluate(()=>window.__adminIdentitySubmits),1,'Keyboard activation must deliver a native submit');assert.equal(auth.length,2,'Invalid name must not request an administrator session');
   await page.locator('#siteAdminName').fill('y');await clickSettled(page,'#siteAdminEnter');await page.waitForFunction(()=>document.body.dataset.secureState==='error'&&document.getElementById('siteAdminIdentityError').textContent==='Enter your name before continuing.');assert.equal(await page.evaluate(()=>window.__adminIdentitySubmits),2,'Pointer activation must deliver a second native submit');assert.equal(auth.length,2,'Repeated invalid name must not request a session');
   await context.setDefaultNavigationTimeout(30000);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>MalGuardSecureMotion.snapshot().paused===true);
   await page.waitForFunction(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).length===0);
   await page.locator('.secure-start').click();assert(await page.locator('#siteAdminIdentityStep').isVisible());
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({engine,width,height,animatedBackground:true,pauseResume:true,keyboard:true,passwordMasked:true,authStateMatchesResponse:true,reducedMotion:true,errors});await context.close();
   console.log(`PASS cinematic forms ${engine} ${width}px`);
  }
 }catch(error){
  const diagnostic=await activePage?.evaluate(()=>({submits:window.__adminIdentitySubmits,consent:document.getElementById('siteAdminConsent')?.checked,invalidControls:[...document.querySelectorAll('#siteAdminIdentityForm :invalid')].map(e=>e.id||e.tagName),state:document.body.dataset.secureState,identityHidden:document.getElementById('siteAdminIdentityStep')?.hidden,error:document.getElementById('siteAdminIdentityError')?.textContent,inputs:['siteAdminName','siteAdminPhone'].map(id=>{const el=document.getElementById(id);return {id,length:el?.value.length,valid:el?.validity.valid,missing:el?.validity.valueMissing,validation:el?.validationMessage};}),active:document.activeElement?.id,motionPressed:document.getElementById('motionToggle')?.getAttribute('aria-pressed'),rootClasses:document.documentElement.className,submitDisabled:document.getElementById('siteAdminEnter')?.disabled})).catch(()=>null);
  console.error('FORM DIAGNOSTIC',JSON.stringify({profile:activeProfile,...diagnostic}));await activePage?.screenshot({path:`test-results/secure-cinematic/failure-${engine}.png`,fullPage:true,animations:'disabled'}).catch(()=>{});throw error;
 }finally{await browser.close();}
}
await writeFile('test-results/secure-cinematic/report.json',JSON.stringify({status:'PASS',profiles:reports},null,2));
