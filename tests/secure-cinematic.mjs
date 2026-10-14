import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base=process.env.MALGUARD_FORM_QA_URL||'https://127.0.0.1:8443';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
const reports=[];await mkdir('test-results/secure-cinematic',{recursive:true});
let activePage,activeProfile;
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
    await page.goto(base+path);await page.waitForFunction(()=>window.MalGuardSecureMotion);await page.waitForTimeout(1100);
    assert.equal(await page.locator('#secure-field,#secure-volume,canvas').count(),0);
    assert(await page.evaluate(()=>MalGuardSecureMotion.snapshot().activeAnimations>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
    const title=await page.locator('.secure-story h1').boundingBox(),nav=await page.locator('#navbar').boundingBox();assert(title.y>=nav.y+nav.height);
    const language=page.locator('.mg-language select').first();await language.selectOption('fa');await page.waitForFunction(()=>document.documentElement.dir==='rtl'&&document.querySelector('.secure-start span').textContent.startsWith('شروع'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));await language.selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('.secure-start span').textContent.startsWith('Start'));
    await page.locator('.secure-start').focus();await page.keyboard.press('Enter');
    await page.locator('#motionToggle').click();assert(await page.evaluate(()=>MalGuardSecureMotion.snapshot().paused));
    assert.equal(await page.locator('.vault-slab').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await page.waitForFunction(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).every(a=>a.playState==='paused'&&!a.pending));
    const frozen=await page.evaluate(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).map(a=>a.currentTime));await page.waitForTimeout(120);
    assert.deepEqual(await page.evaluate(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).map(a=>a.currentTime)),frozen);
    await page.locator('#motionToggle').click();assert.equal(await page.evaluate(()=>MalGuardSecureMotion.snapshot().paused),false);
    await page.screenshot({path:`test-results/secure-cinematic/${path.includes('console')?'admin':'report'}-${engine}-${width}.png`,fullPage:true});
   }
   await page.locator('#siteAdminPassword').focus();let reached=false;for(let i=0;i<10;i++){await page.keyboard.press('Shift+Tab');if(await page.locator('.secure-start').evaluate(el=>el===document.activeElement)){reached=true;break;}}assert(reached,'Start must be reachable through the administrator focus loop');await page.keyboard.press('Enter');
   await page.locator('#siteAdminPassword').fill('synthetic-password');assert.match(await page.locator('#passwordSignal').textContent(),/^•+$/);
   assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'password');
   await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.body.dataset.secureState==='checking');
   assert.equal(await page.locator('.secure-panel').getAttribute('aria-busy'),'true');assert.equal(auth.length,1);releaseAuth();
   await page.waitForFunction(()=>document.body.dataset.secureState==='error');assert.equal(await page.locator('#siteAdminIdentityStep').isVisible(),false);
   allow=true;await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.body.dataset.secureState==='identity');assert(await page.locator('#siteAdminIdentityStep').isVisible());assert.equal(await page.locator('#passwordSignal').textContent(),'');
   await page.locator('#siteAdminName').fill('x');await page.locator('#siteAdminPhone').fill('2025550148');await page.locator('#siteAdminEnter').click();await page.waitForFunction(()=>document.body.dataset.secureState==='error');await page.locator('#siteAdminName').fill('y');await page.locator('#siteAdminEnter').click();await page.waitForFunction(()=>document.body.dataset.secureState==='error');
   await context.setDefaultNavigationTimeout(30000);await page.emulateMedia({reducedMotion:'reduce'});assert(await page.evaluate(()=>MalGuardSecureMotion.snapshot().paused));
   assert.equal(await page.evaluate(()=>document.getElementById('secure-scene').getAnimations({subtree:true}).length),0);
   await page.locator('.secure-start').click();assert(await page.locator('#siteAdminIdentityStep').isVisible());
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({engine,width,height,animatedBackground:true,pauseResume:true,keyboard:true,passwordMasked:true,authStateMatchesResponse:true,reducedMotion:true,errors});await context.close();
   console.log(`PASS cinematic forms ${engine} ${width}px`);
  }
 }catch(error){
  const diagnostic=await activePage?.evaluate(()=>({state:document.body.dataset.secureState,identityHidden:document.getElementById('siteAdminIdentityStep')?.hidden,error:document.getElementById('siteAdminIdentityError')?.textContent,inputs:['siteAdminName','siteAdminPhone'].map(id=>{const el=document.getElementById(id);return {id,length:el?.value.length,valid:el?.validity.valid,missing:el?.validity.valueMissing,validation:el?.validationMessage};}),active:document.activeElement?.id,submitDisabled:document.getElementById('siteAdminEnter')?.disabled})).catch(()=>null);
  console.error('FORM DIAGNOSTIC',JSON.stringify({profile:activeProfile,...diagnostic}));await activePage?.screenshot({path:`test-results/secure-cinematic/failure-${engine}.png`,fullPage:true}).catch(()=>{});throw error;
 }finally{await browser.close();}
}
await writeFile('test-results/secure-cinematic/report.json',JSON.stringify({status:'PASS',profiles:reports},null,2));
