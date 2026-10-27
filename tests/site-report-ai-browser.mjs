import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base=process.env.MALGUARD_FORM_QA_URL||'http://127.0.0.1:8790';
const browser=await chromium.launch(launchOptions('chromium'));
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',ignoreHTTPSErrors:base==='https://127.0.0.1:8443'});let reports=0,models=0,unavailable=false;
 await context.route('https://malware-ai-gray.vercel.app/**',async route=>{const request=route.request(),headers={'access-control-allow-origin':base,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(new URL(request.url()).pathname==='/api/report'){if(request.method()==='GET')return route.fulfill({headers,json:{challenge:'synthetic-challenge',difficulty:15,expiresIn:300}});reports++;return route.fulfill({headers,json:{ok:true,status:'accepted',reference:'MG-SYNTHETIC'}});}
  models++;const body=JSON.parse(request.postData());assert.ok(!JSON.stringify(body).includes('CONTACT_NAME'));assert.ok(!JSON.stringify(body).includes('contact@example.com'));return route.fulfill({status:unavailable?429:200,headers,json:unavailable?{error:'rate_limited'}:{generated:{provider:'workers_ai_rest',selectedModel:'cf_qwen3',text:'Try refreshing the page; the cause is not confirmed.'}}});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/report.html');await page.locator('#reportSubmit').waitFor({state:'visible'});
 for(const failure of [false,true]){unavailable=failure;await page.locator('#reportName').fill('CONTACT_NAME');await page.locator('#reportEmail').fill('contact@example.com');await page.locator('#reportMessage').fill('Synthetic bug: chat response stays pending.');await page.locator('#reportAiConsent').check();await page.locator('#reportSubmit').click();await page.waitForFunction(()=>!document.getElementById('reportSubmit').disabled);assert.match(await page.locator('#reportResult').innerText(),/MG-SYNTHETIC/);assert.match(await page.locator('#reportAiReply').innerText(),failure?/unavailable/:/Try refreshing/);}
 assert.equal(reports,2);assert.equal(models,2);await page.locator('#reportKind').selectOption('security');assert.equal(await page.locator('#reportAiConsent').isEnabled(),false);assert.equal(await page.locator('#reportAiConsent').isChecked(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log(`PASS existing report page ${width}px: acceptance, AI reply/outage, contact exclusion, security exclusion`);await context.close();
}}finally{await browser.close();}

