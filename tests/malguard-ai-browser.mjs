import {toggleSettings,newConversation,openModePicker} from './ai-navigation-helpers.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createApp} from '../services/malguard-ai/server/app.js';
import {createOrchestrator} from '../services/malguard-ai/server/orchestrator.js';
import {chromium,launchOptions} from './browser-runtime.mjs';
const web=express(),root=fileURLToPath(new URL('../',import.meta.url));let requests=0;
const server=web.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
const CLOUD_ORIGIN='https://malware-ai.malguard-security.workers.dev';
const cfFixtures=[
 {id:'chat_granite',mode:'chat',label:'Granite 4 Micro',provider:'workers_ai',available:true},
 {id:'chat_flash',mode:'chat',label:'Gemini Flash-Lite',provider:'gemini',available:true},
 {id:'work_qwen',mode:'work',label:'Qwen3 30B',provider:'workers_ai',available:true},
 {id:'work_gemma',mode:'work',label:'Gemma 4 31B',provider:'gemini',available:true},
 {id:'code_ultra',mode:'code',label:'Nemotron Ultra',provider:'openrouter',available:true},
 {id:'code_super',mode:'code',label:'Nemotron Super',provider:'workers_ai',available:true}
];
const isCFRoute=r=>new URL(r.request().url()).origin===CLOUD_ORIGIN;
function cfFixture(r){
 const url=new URL(r.request().url()),headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
 if(url.pathname==='/api/public-models')return r.fulfill({contentType:'application/json',headers,body:JSON.stringify({models:cfFixtures})});
 const data=r.request().postDataJSON();
 const reply=data.message==='سلام'?'پاسخ فارسی آزمایشی':`Benign test reply ${data.history.length}`;
 return r.fulfill({contentType:'application/json',headers,body:JSON.stringify({text:reply,provider:'workers_ai',model:'@cf/ibm-granite/granite-4.0-h-micro',modelId:data.model,fallback:false})});
}
const testModel={status:()=>({state:'configured',provider:'fixture',model:'benign-test-model',defaultModel:'llama70b',models:[{id:'llama70b',label:'Llama 3.3 70B',state:'configured'},{id:'llama8b',label:'Llama 3.1 8B',state:'configured'},{id:'gemini_flash',label:'Gemini 3.8 Flash',state:'disabled'}]}),respond:async(message,locale,history,selectedModel)=>{if(message==='سلام')assert.equal(selectedModel,'chat_flash');return {text:message==='سلام'&&locale==='fa'?'پاسخ فارسی آزمایشی':`Benign test reply ${history.length}`,provider:'fixture',model:'benign-test-model',securityAnalysis:false};}};
web.use('/api/malguard-ai',(req,res,next)=>{if(req.method==='POST')requests++;next();},createApp({orchestrator:createOrchestrator(undefined,testModel),enabled:true,publicOrigin:base,log:()=>{}}));web.use(express.static(root));
const browser=await chromium.launch(launchOptions('chromium'));
const skipWelcome=context=>context.addInitScript(()=>localStorage.setItem('malguard.ai.welcome.v3','seen'));
try{
 // Product cards introduce platform choices before opening the assistant.
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  await skipWelcome(context);await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await context.route('**/*',r=>isCFRoute(r)?cfFixture(r):new URL(r.request().url()).origin===base?r.continue():r.abort());
  const before=requests;
  for(const [path,selector] of [['/','#products .product-ai a.text-link'],['/products.html','.product-ai .mg-home-product-link']]){
   await page.goto(base+path);
   const link=page.locator(selector);assert.equal(await link.getAttribute('href'),'/ai-product.html');assert.match(await link.innerText(),/MalGuard AI/);
   const visited=[];const record=frame=>{if(frame===page.mainFrame())visited.push(new URL(frame.url()).pathname);};
   page.on('framenavigated',record);await link.click();await page.waitForURL(base+'/ai-product.html');
   assert.equal(await page.getByRole('heading',{name:'Android · Samsung'}).count(),1);assert.equal(await page.getByRole('heading',{name:'Windows'}).count(),1);
   await page.getByRole('link',{name:/Open web app/}).first().click();await page.waitForURL(base+'/ai/');
   await page.waitForFunction(()=>!document.getElementById('send').disabled);page.off('framenavigated',record);
   assert.deepEqual(visited,['/ai-product.html','/ai/'],'Product card opens the platform guide, then the web app');
   assert.equal(await page.locator('#composer').isVisible(),true);assert.equal(await page.locator('#settings-panel').getAttribute('open'),null);
   assert.equal(await page.locator('.mg-card-hero--radar').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Assistant must fit after navigation');
  }
  for(const path of ['/ai-intelligence.html','/malware-ai.html']){
   await page.goto(base+path);await page.waitForURL(base+'/ai/');await page.waitForFunction(()=>!document.getElementById('send').disabled);
   assert.equal(await page.locator('#composer').isVisible(),true,'Legacy AI entry opens the current chat');
  }
  await page.goto(base+'/');await page.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
  await page.locator('#menuBtn').click();await page.locator('#navLinks a[href="/ai/"]').click();await page.waitForURL(base+'/ai/');
  assert.equal(requests,before,'Navigating into AI must not submit messages, files or consent');
  await context.close();console.log(`PASS platform guide, web app, shared menu and legacy AI URLs at ${width}px`);
 }
 for(const width of [360,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
  await skipWelcome(context);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{if(isCFRoute(r))return cfFixture(r);if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort();});
  await page.goto(base+'/ai/');await page.locator('#send').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('send').disabled);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#settings-panel').getAttribute('open'),null);
  assert.equal(await page.locator('#model').isVisible(),true);assert.equal(await page.locator('#composer #model').count(),1);assert.equal(await page.locator('#device-note').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);
  if([390,1280].includes(width)){await mkdir('test-results/malguard-ai',{recursive:true});await page.screenshot({path:`test-results/malguard-ai/quiet-empty-${width}.png`,fullPage:true});}
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  assert.equal(await page.locator('#language-select').count(),0);assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  const beforeMenu=requests;
  await page.locator('#attach-toggle').focus();await page.locator('#attach-toggle').press('Enter');
  assert.equal(await page.locator('#attach-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#attach-options').isVisible(),true);
  assert.ok(await page.locator('#attach-options').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'Attachment actions fit the viewport');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#attach-options').isVisible(),false);
  assert.equal(await page.locator('#attach-toggle').evaluate(n=>n===document.activeElement),true,'Escape returns focus to the attachment trigger');
  await page.locator('#attach-toggle').click();await page.mouse.click(4,4);assert.equal(await page.locator('#attach-options').isVisible(),false,'Outside click closes attachment actions');
  await page.locator('#attach-toggle').click();await page.locator('#attach-inspect').click();
  assert.equal(await page.locator('#mode').inputValue(),'worker');assert.equal(await page.locator('#tool').inputValue(),'auto');
  assert.equal(await page.locator('#attach-options').isVisible(),false);
  await page.locator('#attach-toggle').click();await page.locator('#attach-chat').click();
  assert.equal(await page.locator('#mode').inputValue(),'chat');assert.equal(await page.locator('#tool').inputValue(),'auto');
  assert.equal(requests,beforeMenu,'Attachment actions must not submit requests');
  assert.equal(await page.locator('#local-download').isVisible(),false);assert.equal(await page.locator('#local-offer').isVisible(),false,'Attachment actions must not start model downloads');
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  await page.locator('#attach-toggle').click();const choosingFile=page.waitForEvent('filechooser');await page.locator('#attach-file').click();
  await (await choosingFile).setFiles({name:'benign.txt',mimeType:'text/plain',buffer:Buffer.from('Hello, harmless browser fixture.')});
  assert.equal(await page.locator('#attach-options').isVisible(),false);assert.equal(requests,beforeMenu,'Choosing a file does not upload it');
  const before=requests;await page.locator('#send').click();assert.equal(requests,before,'no upload without consent');
  await page.locator('#file-consent').check();await toggleSettings(page);
  await page.locator('#send').click();
  try{await page.getByRole('heading',{name:'No malicious evidence found in the checks performed.'}).waitFor({timeout:15000});}
  catch(error){console.error('Browser failure:',await page.locator('#conversation').innerText(),errors);throw error;}
  assert.equal(await page.locator('#file-consent').isChecked(),true);
  await page.getByText('Inspection details',{exact:true}).click();assert.match(await page.locator('.result code').last().innerText(),/sha256/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),['malguard-ai-permissions-v1','malguard.ai.welcome.v3']);assert.ok(!JSON.stringify(await page.evaluate(()=>({...localStorage}))).includes('benign.txt'));
  assert.equal(await page.locator('#tool option[value="ai_web"]').isDisabled(),true);
  assert.equal(await page.locator('#tool option[value="malwarebazaar"]').isDisabled(),true);
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  await page.getByRole('heading',{name:'No malicious evidence found in the checks performed.'}).waitFor();
  if([390,1280].includes(width)){await mkdir('test-results/malguard-ai',{recursive:true});await page.screenshot({path:`test-results/malguard-ai/${width}.png`,fullPage:true});}
  await newConversation(page);assert.equal(await page.locator('#conversation').innerText(),'');
  if(width===1280){
   if(!(await page.locator('#mode-toggle').isVisible()))await page.locator('#navigation-toggle').click();await openModePicker(page);await page.locator('#chat-tab').click();assert.equal(await page.locator('#workspace-panel').isVisible(),false);
   await toggleSettings(page);if(await page.locator('#permissions').getAttribute('open')===null)await page.locator('#permissions summary').click();await page.locator('#model-consent').check();await toggleSettings(page);
   await page.locator('#message').fill('Hello');await page.locator('#send').click();await page.getByText('Benign test reply 0',{exact:true}).waitFor();
   assert.equal(await page.locator('.assistant-message h3').count(),0);
   assert.equal(await page.getByText('workers_ai · @cf/ibm-granite/granite-4.0-h-micro',{exact:true}).isVisible(),false);
   await page.locator('.response-details summary').first().click();assert.equal(await page.getByText('workers_ai · @cf/ibm-granite/granite-4.0-h-micro',{exact:true}).isVisible(),true);
   await page.locator('.response-details summary').first().click();
   await page.screenshot({path:'test-results/malguard-ai/quiet-reply-1280.png',fullPage:true});
   await page.locator('#message').fill('Continue');await page.locator('#send').click();await page.getByText('Benign test reply 2',{exact:true}).waitFor();
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.locator('#model').selectOption('chat_flash');await page.locator('#message').fill('سلام');await page.locator('#send').click();await page.getByText('پاسخ فارسی آزمایشی',{exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await toggleSettings(page);await page.locator('#mode').selectOption('worker');await toggleSettings(page);await page.locator('#message').fill('Explain a technical function');await page.locator('#send').click();await page.getByText('Benign test reply 0',{exact:true}).waitFor();
   await newConversation(page);
   console.log('PASS Chat multi-turn context and inspection-only mode (injected benign model fixture).');
  }
  await page.reload();assert.equal(await page.locator('#conversation').innerText(),'');assert.equal(await page.locator('#file-consent').isChecked(),true);await toggleSettings(page);await page.locator('#permissions summary').click();await page.locator('#revoke-permissions').click();assert.equal(await page.locator('#file-consent').isChecked(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  console.log(`PASS real AI frontend → backend → static worker, consent, English interface, no overflow/history at ${width}px`);
 }
 const context=await browser.newContext(),page=await context.newPage();await skipWelcome(context);await context.route('**/api/malguard-ai/status',r=>r.abort());await page.goto(base+'/ai/');await toggleSettings(page);await page.getByRole('status').filter({hasText:'Backend unavailable'}).waitFor();assert.equal(await page.locator('#send').isDisabled(),true);await context.close();console.log('PASS backend failure shown; submission disabled.');
 const errorContext=await browser.newContext({timezoneId:'Asia/Tehran'}),errorPage=await errorContext.newPage();
 await skipWelcome(errorContext);
 const retryAt=new Date(Date.now()+300000).toISOString();let errorCase=0;
 await errorContext.route('**/api/malguard-ai/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,model:testModel.status(),tools:{}})}));
 await errorContext.route('**/api/public-models',cfFixture);
 await errorContext.route('**/api/public-model-chat',route=>{
  const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  errorCase++;
  if(errorCase===1)return route.fulfill({status:429,contentType:'application/json',headers,body:JSON.stringify({error:'provider_rate_limited',retryAt,retryAfterSeconds:300})});
  const result=errorCase===2?{error:'provider_quota_exhausted'}:{error:'provider_billing_required'};
  return route.fulfill({status:503,contentType:'application/json',headers,body:JSON.stringify(result)});
 });
 await errorPage.goto(base+'/ai/');await errorPage.waitForFunction(()=>!document.getElementById('send').disabled);
 await toggleSettings(errorPage);await errorPage.locator('#permissions summary').click();await errorPage.locator('#model-consent').check();await toggleSettings(errorPage);
 await errorPage.locator('#message').fill('سلام');await errorPage.locator('#send').click();
 await errorPage.getByRole('alert').filter({hasText:'request or token limit'}).waitFor();
 const expected=await errorPage.evaluate(stamp=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'long'}).format(new Date(stamp)),retryAt);
 await errorPage.waitForFunction(expected=>document.querySelector('[role=alert]')?.innerText.includes(expected),expected);assert.ok((await errorPage.getByRole('alert').innerText()).includes(expected));assert.equal(await errorPage.locator('#message').inputValue(),'سلام');
 await errorPage.locator('#send').click();await errorPage.getByRole('alert').filter({hasText:'did not supply a reset time'}).waitFor();
 assert.match(await errorPage.getByRole('alert').last().innerText(),/did not supply a reset time/);
 assert.match(await errorPage.getByRole('alert').last().innerText(),/did not supply a reset time/);
 await errorPage.locator('#send').click();await errorPage.getByRole('alert').filter({hasText:'credit or billing'}).waitFor();
 await errorContext.close();console.log('PASS HTTP and streamed provider limit/quota/billing errors, real local retry time and preserved message (fixtures).');
 // Device inference is a Worker fixture here: no model weights or GPU results
 // are fabricated as live verification. Assert the privacy/consent boundaries.
 const device=await browser.newContext({viewport:{width:390,height:844}}),localPage=await device.newPage();
 await device.addInitScript(()=>{
  Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});
  window.localWorkerCalls=[];
  window.Worker=class{postMessage(data){window.localWorkerCalls.push(data);setTimeout(()=>this.onmessage?.({data:{generated:{text:'پاسخ محلی آزمایشی',provider:'on_device',model:data.model,securityAnalysis:false}}}),5);}terminate(){}};
 });
 const beforeLocal=requests,localExternal=[];await device.route('**/*',r=>{if(isCFRoute(r))return cfFixture(r);if(new URL(r.request().url()).origin===base)return r.continue();localExternal.push(r.request().url());return r.abort();});
 await localPage.goto(base+'/ai/');await localPage.waitForFunction(()=>!document.getElementById('send').disabled);assert.equal(await localPage.locator('#model').inputValue(),'chat_granite','Prefer the fast Cloudflare chat model without downloading');
 await localPage.waitForFunction(()=>!document.getElementById('send').disabled);
 assert.equal(await localPage.locator('#local-welcome').isVisible(),false,'local downloads must remain opt-in');assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),0);
 await localPage.locator('#model').selectOption('local_fast');
 await localPage.locator('#model').selectOption('__downloads');
 await localPage.locator('#local-offer').waitFor({state:'visible'});
 assert.match(await localPage.locator('#offer-info').innerText(),/no provider daily message quota/);
 assert.equal(await localPage.locator('#offer-model option').count(),2);
 assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),0,'entering the app must not download weights');
 await localPage.locator('#local-offer button[value="later"]').click();
 await localPage.waitForFunction(()=>!document.getElementById('local-offer').open&&document.getElementById('model').value==='local_fast');
 assert.equal(await localPage.locator('#model').inputValue(),'local_fast','Later preserves the current selection without a download');
 assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),0);
 await localPage.reload();await localPage.waitForFunction(()=>!document.getElementById('send').disabled);
 assert.equal(await localPage.locator('#local-offer').isVisible(),false,'do not repeat the offer in this tab');
 await localPage.locator('#model').selectOption('local_fast');
 await localPage.locator('#message').fill('سلام');await localPage.locator('#send').click();await localPage.locator('#local-download').waitFor({state:'visible'});
 assert.match(await localPage.locator('#download-info').innerText(),/985 MB/);assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),0);assert.equal(requests,beforeLocal);
 await localPage.locator('#local-download button[value="cancel"]').click();assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),0);
 await localPage.locator('#send').click();await localPage.locator('#local-download button[value="download"]').click();await localPage.getByText('پاسخ محلی آزمایشی',{exact:true}).waitFor();
 assert.equal(requests,beforeLocal);assert.equal(await localPage.evaluate(()=>localWorkerCalls[0].model),'local_fast');assert.match(await localPage.evaluate(()=>localWorkerCalls[0].messages[0].content),/فارسی/);
 await localPage.locator('#model').selectOption('local_medium');
 await localPage.locator('#message').fill('Explain DNS');await localPage.locator('#send').click();await localPage.locator('#local-download').waitFor({state:'visible'});assert.match(await localPage.locator('#download-info').innerText(),/2268 MB/);
 await localPage.keyboard.press('Escape');assert.equal(await localPage.evaluate(()=>localWorkerCalls.length),1,'Escape must not reuse previous download approval');
 assert.equal(requests,beforeLocal);assert.deepEqual(localExternal,[]);await device.close();console.log('PASS on-device download/cancel consent, local-only text and separate model download approval (mock Worker).');
 const downloadContext=await browser.newContext({viewport:{width:360,height:740}}),downloadPage=await downloadContext.newPage();
 await downloadContext.addInitScript(()=>{
  Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});
  window.localWorkerCalls=[];
  window.Worker=class{postMessage(data){window.localWorkerCalls.push(data);setTimeout(()=>this.onmessage?.({data:{prepared:true}}),5);}terminate(){}};
 });
 const downloadExternal=[];await downloadContext.route('**/*',r=>{if(isCFRoute(r))return cfFixture(r);if(new URL(r.request().url()).origin===base)return r.continue();downloadExternal.push(r.request().url());return r.abort();});
 await downloadPage.goto(base+'/ai/');await downloadPage.waitForFunction(()=>!document.getElementById('send').disabled);
 assert.equal(await downloadPage.locator('#local-welcome').isVisible(),false,'Local downloads remain opt-in');await downloadPage.locator('#model').selectOption('__downloads');
 await downloadPage.locator('#local-offer').waitFor({state:'visible'});
 await downloadPage.locator('#offer-model').selectOption('local_medium');assert.match(await downloadPage.locator('#offer-size').innerText(),/2268 MB/);
 assert.equal(await downloadPage.evaluate(()=>localWorkerCalls.length),0);
 assert.ok(await downloadPage.evaluate(()=>document.querySelector('#local-offer').scrollWidth<=document.querySelector('#local-offer').clientWidth),'offer fits a narrow phone');
 const beforePrepare=requests;await downloadPage.locator('#local-offer button[value="download"]').click();
 await downloadPage.waitForFunction(()=>document.getElementById('model').value==='local_medium'&&!document.getElementById('send').disabled);
 assert.deepEqual(await downloadPage.evaluate(()=>localWorkerCalls),[{operation:'prepare',model:'local_medium'}]);
 assert.equal(requests,beforePrepare,'preparing a local model sends no conversation to the backend');
 assert.equal(await downloadPage.locator('#conversation').innerText(),'');assert.deepEqual(downloadExternal,[]);
 await downloadContext.close();console.log('PASS optional download prepares only the selected model, without sending a chat (mock Worker).');
 const workContext=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'}),workPage=await workContext.newPage();await skipWelcome(workContext);
 await workContext.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
 const desktopRequests=[];
 await workContext.route('**/*',r=>{
  const url=new URL(r.request().url());
  if(isCFRoute(r))return cfFixture(r);
  if(url.origin===base)return r.continue();
  if(url.origin==='http://127.0.0.1:11434'){
   desktopRequests.push({path:url.pathname,body:r.request().postDataJSON()});
   return r.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname==='/api/tags'?{models:[{name:'qwen3:8b'},{name:'arbitrary:latest'}]}:{model:'qwen3:8b',done:true,message:{role:'assistant',content:'Private desktop reply'}})});
  }
  return r.abort();
 });
 await workPage.goto(base+'/ai/');await workPage.waitForFunction(()=>!document.querySelector('#send').disabled);
 assert.equal(desktopRequests.length,0,'Opening the site must not probe local services');
 await workPage.locator('#message').fill('Chat draft');await openModePicker(workPage);await workPage.locator('#workspace-tab').click();
 assert.equal(await workPage.locator('#workspace-tab').getAttribute('aria-pressed'),'true');assert.equal(await workPage.locator('#workspace-panel').isVisible(),true);assert.equal(await workPage.locator('#model').isVisible(),false);assert.equal(await workPage.locator('#message').inputValue(),'');
 await workPage.locator('#message').fill('Work draft');await openModePicker(workPage);await workPage.locator('#chat-tab').click();assert.equal(await workPage.locator('#message').inputValue(),'Chat draft');assert.equal(await workPage.locator('#workspace-panel').isVisible(),false);assert.equal(await workPage.locator('#toolbox').isVisible(),false);
 await openModePicker(workPage);await workPage.locator('#workspace-tab').click();assert.equal(await workPage.locator('#message').inputValue(),'Work draft');await openModePicker(workPage);await workPage.locator('#chat-tab').click();
 await workPage.locator('#open-downloads').click();assert.equal(await workPage.locator('#download-hub').isVisible(),true);await workPage.locator('#hub-desktop').click();await workPage.locator('#desktop-models').waitFor({state:'visible'});await workPage.locator('.desktop-setup > summary').click();
 assert.equal(await workPage.locator('#desktop-model option').count(),6);assert.match(await workPage.locator('#desktop-origin').innerText(),/OLLAMA_ORIGINS=https:\/\/malguard.site/);assert.equal(desktopRequests.length,0,'Opening catalog must not connect or download');
 await workPage.locator('#desktop-model').selectOption('native_deepseek671');assert.match(await workPage.locator('#desktop-command').innerText(),/ollama pull deepseek-r1:671b/);assert.match(await workPage.locator('#desktop-model-info').innerText(),/404 GB/);
 await workPage.locator('#desktop-model').selectOption('native_qwen8');await workPage.locator('#desktop-connect').click();await workPage.getByText('Connected. Installed models are available in the chat model picker.',{exact:true}).waitFor();
 assert.deepEqual(desktopRequests.map(r=>r.path),['/api/tags']);await workPage.locator('#desktop-models button[value="close"]').click();assert.equal(await workPage.locator('#model').inputValue(),'native_qwen8');
 const beforeNative=requests;await workPage.locator('#message').fill('A private desktop question');await workPage.locator('#send').click();await workPage.getByText('Private desktop reply',{exact:true}).waitFor();assert.equal(requests,beforeNative);assert.deepEqual(desktopRequests.map(r=>r.path),['/api/tags','/api/chat']);assert.equal(desktopRequests[1].body.model,'qwen3:8b');
 await openModePicker(workPage);await workPage.locator('#workspace-tab').click();assert.equal(await workPage.getByText('Private desktop reply',{exact:true}).count(),0,'Workspace has its own conversation');await openModePicker(workPage);await workPage.locator('#chat-tab').click();assert.equal(await workPage.getByText('Private desktop reply',{exact:true}).count(),1);
 assert.ok(await workPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await workContext.close();console.log('PASS dedicated Workspace, independent drafts/history, six desktop models and explicit local-only connection/chat');

}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
