import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base=process.env.MALGUARD_FORM_QA_URL||'https://127.0.0.1:8443',privatePage='/console-8d42b69fda13705cc47a.html';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'],reports=[];
await mkdir('test-results/secure-forms',{recursive:true});
async function settledFocus(page,selector){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert(await page.locator(selector).evaluate(e=>document.activeElement===e),'Country picker returned focus to the wrong field');
}
for(const engine of engines){
 const browser=await({chromium,webkit}[engine]).launch(launchOptions(engine));
 for(const width of [320,390,820,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});let mode='accept',captured=[],authBodies=[],authAllow=false;const automaticGithubNavigations=[];
  const cors={'access-control-allow-origin':base,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
   if(request.isNavigationRequest()&&url.hostname==='github.com')automaticGithubNavigations.push(url.href);
   if(url.origin==='https://malware-ai-gray.vercel.app'){
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(url.pathname==='/api/report'){
     if(request.method()==='GET')return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({challenge:'synthetic-test-challenge-'+randomUUID(),difficulty:15,expiresIn:300})});
     const body=JSON.parse(request.postData());captured.push(body);
     const canonical=JSON.stringify([body.kind,body.message,body.name,body.email]),hash=createHash('sha256').update(canonical).digest('hex'),proof=createHash('sha256').update(body.challenge+'\n'+hash+'\n'+body.nonce).digest();assert.equal(proof[0],0);assert(proof[1]<2);
     return route.fulfill({status:mode==='accept'?200:503,headers:cors,contentType:'application/json',body:JSON.stringify(mode==='accept'?{ok:true,status:'accepted',reference:'MG-FIXTURE'}:{code:'REPORT_NOT_ACCEPTED'})});
    }
    if(url.pathname==='/api/auth'){
     const body=JSON.parse(request.postData());authBodies.push(body);
     if(!authAllow)return route.fulfill({status:401,headers:cors,contentType:'application/json',body:'{"error":"Access denied"}'});
     return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body.phase==='enter'?{emailConfigured:true,emailSent:true,sessionToken:'synthetic-session-not-a-credential',sessionExpiresAt:Date.now()+3600000}:{ok:true})});
    }
   }
   return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/report.html',privatePage,'/source.html','/security-policy.html','/privacy-policy.html','/code-signing.html','/contributing.html','/core-guide.html']){
   assert.equal((await page.goto(base+route)).status(),200);await page.waitForFunction(()=>document.documentElement.dataset.experienceReady==='true');
   assert(await page.locator('h1').first().isVisible());assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=1,route+' horizontal overflow');
   const heading=await page.locator('h1').first().boundingBox(),header=await page.locator('#navbar').boundingBox();assert(heading.y>=header.y+header.height,route+' heading overlaps the shared header');
   // The contributor page intentionally links to official contribution tasks.
   // Keep form routes self-contained and reject automatic external navigation.
   assert.equal(new URL(page.url()).origin,base,route+' left the first-party origin');
   assert.equal(new URL(page.url()).pathname,route,route+' navigated without user interaction');
   assert.equal(await page.locator('meta[http-equiv="refresh" i]').count(),0,route+' contains a timed redirect');
   assert.deepEqual(automaticGithubNavigations,[],route+' attempted automatic GitHub navigation');
   if(route==='/contributing.html'){
    const links=await page.locator('a[href*="github.com"]').evaluateAll(nodes=>nodes.map(node=>node.href));assert.ok(links.length>0);
    assert.ok(links.every(href=>{const url=new URL(href);return url.protocol==='https:'&&url.hostname==='github.com'&&url.pathname.startsWith('/MalGuard/malguard-core/');}),'Contributor links must lead to the official project');
   }else assert.equal(await page.locator('a[href*="github.com"]').count(),0,route+' unexpectedly links a form visitor to GitHub');
  }
  await page.goto(base+'/report.html?kind=security');assert.equal(await page.locator('#reportKind').inputValue(),'security');
  await page.locator('#reportMessage').fill('سلام');await page.locator('#reportSubmit').click();await page.waitForFunction(()=>document.querySelector('#reportResult').classList.contains('success'),null,{timeout:30000});
  assert.equal(captured.at(-1).message,'سلام');assert.equal(await page.locator('#reportMessage').inputValue(),'');assert(page.url().includes('/report.html'));assert((await page.locator('#reportResult').innerText()).includes('malguard.security@gmail.com'));
  mode='fail';await page.locator('#reportMessage').fill('Benign failure-path report');await page.locator('#reportSubmit').click();await page.waitForFunction(()=>document.querySelector('#reportResult').classList.contains('error'),null,{timeout:30000});
  assert.equal(await page.locator('#reportMessage').inputValue(),'Benign failure-path report');const lastBody=captured.at(-1);await page.locator('#reportSubmit').click();await page.waitForFunction(()=>!document.getElementById('reportSubmit').disabled);assert.deepEqual(captured.at(-1),lastBody,'Retry must reuse the same provider idempotency identity');
  await page.screenshot({path:`test-results/secure-forms/report-${engine}-${width}.png`});
  await page.goto(base+'/#mg-console-8d42b69fda13705cc47a');await page.waitForURL(base+privatePage);assert(await page.locator('#navbar').evaluate(e=>e.inert));await page.locator('#siteAdminPassword').fill('benign-test-password');
  assert.equal(await page.locator('#siteAdminPassword').getAttribute('type'),'password');assert.match(await page.locator('#passwordSignal').textContent(),/^•+$/);
  await page.locator('#siteAdminPasswordSubmit').click();await page.waitForFunction(()=>document.getElementById('siteAdminPasswordError').textContent==='Access denied');assert.equal(await page.locator('#siteAdminIdentityStep').isVisible(),false);
  authAllow=true;await page.locator('#siteAdminPasswordSubmit').click();await page.waitForSelector('#siteAdminIdentityStep:not([hidden])');await page.locator('#siteAdminName').fill('Synthetic Test');
  const phone=page.locator('#siteAdminPhone');assert.equal(await page.locator('.phone-country-button').getAttribute('data-country'),'US');await phone.fill('2025550148');assert.match(await phone.inputValue(),/202.*555.*0148/);
  await page.locator('.phone-country-button').click();await page.locator('.country-picker input').fill('+98');await page.locator('.country-option:has(img[src$="/IR.svg"])').click();await settledFocus(page,'#siteAdminPhone');await phone.fill('09123456789');assert.equal(await page.locator('.phone-country-button').getAttribute('data-country'),'IR');assert.equal(await page.evaluate(()=>MalGuardPhone.validate(document.getElementById('siteAdminPhone'))),'+989123456789');
  await phone.fill('+93701234567');assert.equal(await page.locator('.phone-country-button').getAttribute('data-country'),'AF');assert.equal(await page.evaluate(()=>MalGuardPhone.validate(document.getElementById('siteAdminPhone'))),'+93701234567');
  await phone.fill('+12025550148');assert.equal(await page.locator('.phone-country-button').getAttribute('data-country'),'US');
  await page.locator('.phone-country-button').click();await page.keyboard.press('Escape');await settledFocus(page,'.phone-country-button');
  await page.locator('#siteAdminConsent').check();await page.screenshot({path:`test-results/secure-forms/admin-${engine}-${width}.png`});await page.locator('#siteAdminEnter').click();await page.waitForURL(base+'/');
  assert.equal(authBodies.at(-1).phone,'+12025550148');assert.equal(await page.locator('#adminSessionBadge').isVisible(),true);assert.equal(await page.locator('#siteAdminEntry').count(),0);assert.equal(await page.locator('a[href*="console-"]').count(),0);
  await page.evaluate(()=>{sessionStorage.removeItem('malguard-admin-session');sessionStorage.removeItem('malguard-admin-session-exp');});
  // The public Malware AI chat is retired, so it must never request credentials or contact auth.
  const authCallsBeforeRetirement=authBodies.length;
  await page.goto(base+'/malware-ai-windows.html');
  await page.waitForFunction(()=>document.documentElement.dataset.experienceReady==='true');
  assert.equal(await page.getByRole('heading',{name:'Continue with MalGuard AI.'}).count(),1);
  assert.equal(await page.locator('#accessGate,#accessPassword,#accessPhone,#aiApp').count(),0,'Retired chat must not expose its old access flow');
  assert.equal(authBodies.length,authCallsBeforeRetirement,'Retired page must not contact authentication API');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  assert.ok(await page.locator('a[href="/ai/"]').count()>0);
  assert.deepEqual(errors,[]);reports.push({engine,width,layouts:8,samePageReport:true,shortPersianMessage:true,retryPreserved:true,maskedPassword:true,phoneCountries:['US','IR','AF'],privateAccess:true,retiredAIChatDoesNotAuthenticate:true,errors});await context.close();console.log(`PASS secure forms ${engine} ${width}px`);
 }
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},reducedMotion:'no-preference'}),page=await context.newPage();await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/report.html');await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');assert.equal(await page.locator('#secure-scene,#secure-field,#secure-volume').count(),0);assert.equal(await page.locator('script[src*="home-opening-projection"]').count(),0);
 await page.locator('#reportMessage').fill('Harmless animation test');assert.equal(await page.locator('#reportMessage').inputValue(),'Harmless animation test');assert.equal(await page.locator('#reportSubmit').isEnabled(),true);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.documentElement.classList.contains('type-system'));assert.equal(await page.locator('html.type-system').count(),0);await context.close();
 await browser.close();
}
await writeFile('test-results/secure-forms/report.json',JSON.stringify({status:'PASS',profiles:reports},null,2));
