import {toggleSettings,newConversation} from './ai-navigation-helpers.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,launchOptions} from './browser-runtime.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),external=[],posts=[];
const server=createServer(async(req,res)=>{
 if(req.method==='POST')posts.push(req.url);
 if(req.url.startsWith('/api/')){res.writeHead(503).end();return;}
 try{const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root))throw new Error();
 const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const CF_ORIGIN='https://malware-ai.malguard-security.workers.dev';
const CF_FIXTURES=[
 {id:'chat_granite',mode:'chat',label:'Granite 4 Micro',provider:'workers_ai',available:true},
 {id:'chat_flash',mode:'chat',label:'Gemini Flash-Lite',provider:'gemini',available:true},
 {id:'work_qwen',mode:'work',label:'Qwen3 30B',provider:'workers_ai',available:true},
 {id:'work_gemma',mode:'work',label:'Gemma 4 31B',provider:'gemini',available:true},
 {id:'code_ultra',mode:'code',label:'Nemotron Ultra 550B',provider:'openrouter',available:true},
 {id:'code_super',mode:'code',label:'Nemotron Super',provider:'workers_ai',available:true}
];
const cfResponse=(route,{enabled=false}={})=>{
 const url=new URL(route.request().url()),headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(url.pathname==='/api/public-models')return route.fulfill({status:enabled?200:503,headers,contentType:'application/json',body:JSON.stringify(enabled?{models:CF_FIXTURES}:{error:'unavailable'})});
 if(url.pathname==='/api/public-model-chat')return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({text:'سلام! آماده‌ام.',provider:'workers_ai',model:'@cf/ibm-granite/granite-4.0-h-micro',modelId:'chat_granite'})});
 return route.abort();
};
const isCF=r=>new URL(r.request().url()).origin===CF_ORIGIN;
const browser=await chromium.launch(launchOptions('chromium'));
const output=process.env.MALGUARD_PREVIEW_DIR||'test-results/malguard-ai-local';await mkdir(output,{recursive:true});
try{
 for(const width of [360,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{if(isCF(r))return cfResponse(r);if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort();});
  await context.addInitScript(()=>{
   localStorage.setItem('malguard.ai.language.v1','fa');
   Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});
   window.workerCalls=[];window.workerMode='success';window.terminated=0;
   window.Worker=class{
    postMessage(data){window.workerCalls.push(data);if(data.operation==='clear'){queueMicrotask(()=>this.onmessage?.({data:{cleared:true}}));return;}
     this.timer=setTimeout(()=>{this.onmessage?.({data:{progress:42}});if(window.workerMode==='pending')return;
      setTimeout(()=>this.onmessage?.({data:window.workerMode==='error'?{error:'local_failed'}:data.operation==='prepare'?{prepared:true}:{generated:{text:'پاسخ آزمایشی محلی',provider:'on_device',model:data.model,securityAnalysis:false}}}),100);
     },50);
    }
    terminate(){clearTimeout(this.timer);this.onmessage=undefined;window.terminated++;}
   };
  });
  await page.goto(base+'/ai/');await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.evaluate(()=>workerCalls.length),0,'First visit must not fetch model weights');
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
  assert.equal(await page.locator('#local-welcome').isVisible(),false,'Download invitation must be opt-in');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([390,1280].includes(width))await page.screenshot({path:path.join(output,`initial-${width}.png`)});
  assert.equal(await page.locator('#model').isVisible(),true);assert.equal(await page.locator('#composer #model').count(),1);assert.equal(await page.locator('#model-toolbar').count(),0);assert.equal(await page.locator('#device-note').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);assert.equal(await page.locator('#settings-panel').getAttribute('open'),null);
  assert.equal(await page.locator('#model').inputValue(),'','No downloadable model selected automatically while cloud is offline');
  await page.locator('#model').selectOption('local_fast');
  if([390,1280].includes(width))await page.screenshot({path:path.join(output,`quiet-${width}.png`)});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.locator('#local-welcome').isVisible(),false,'Download invitation stays opt-in across reload');
  await page.locator('#model').selectOption('__downloads');await page.locator('#local-offer').waitFor({state:'visible'});assert.equal(await page.locator('#model').inputValue(),'local_fast','Opening downloads restores the active selection');
  assert.match(await page.locator('#offer-size').innerText(),/985/);
  await page.locator('#offer-model').selectOption('local_medium');
  assert.match(await page.locator('#offer-size').innerText(),/2268/);assert.match(await page.locator('#offer-size').innerText(),/3432/);
  assert.equal(await page.evaluate(()=>workerCalls.length),0,'Changing a model downloads nothing');
  if([390,1280].includes(width))await page.screenshot({path:path.join(output,`models-${width}.png`)});
  await page.locator('#local-offer').evaluate(dialog=>{window.offerClosed=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(),{once:true}));});await page.keyboard.press('Escape');await page.evaluate(()=>window.offerClosed);assert.equal(await page.evaluate(()=>workerCalls.length),0);
  await page.locator('#model').selectOption('__downloads');await page.locator('#offer-model').selectOption('local_medium');
  await page.evaluate(()=>window.workerMode='pending');
  await page.locator('#local-offer button[value="download"]').click();
  await page.waitForFunction(()=>document.getElementById('download-progress').value===42);
  await page.locator('#cancel-download').click();await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.ok(await page.evaluate(()=>terminated>0));assert.equal(await page.locator('#model-progress').isVisible(),false);
  assert.equal(await page.locator('#model').inputValue(),'local_fast','Cancellation must not select an unprepared model');
  await page.locator('#model').selectOption('__downloads');await page.locator('#offer-model').selectOption('local_medium');await page.evaluate(()=>window.workerMode='error');
  await page.locator('#local-offer button[value="download"]').click();await page.getByRole('alert').waitFor();
  await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.locator('#model').inputValue(),'local_fast','Failure must not activate a model');
  await page.locator('#model').selectOption('__downloads');await page.locator('#offer-model').selectOption('local_medium');await page.evaluate(()=>window.workerMode='success');
  await page.locator('#local-offer button[value="download"]').click();
  await page.waitForFunction(()=>document.getElementById('model').value==='local_medium'&&!document.getElementById('manage-models').disabled);
  assert.match(await page.locator('#device-note').textContent(),/Ready/);
  assert.deepEqual(await page.evaluate(()=>workerCalls.map(c=>c.operation)),['prepare','prepare','prepare']);
  assert.equal(posts.length,0,'Preparing and selecting models must not submit conversation');
  assert.equal(await page.locator('html').getAttribute('dir'),'ltr');assert.match(await page.locator('#device-note').textContent(),/Ready/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.reload();await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.locator('#model').inputValue(),'local_medium','The chosen local model persists without downloading on reload');
  assert.equal(await page.evaluate(()=>workerCalls.length),0);
  await context.close();console.log(`PASS opt-in download, cancel, failure/retry, active model and English interface at ${width}px (mock worker)`);
 }
 const delayed=await browser.newContext(),delayedPage=await delayed.newPage();
 await delayed.addInitScript(()=>{localStorage.setItem('malguard.ai.welcome.v2','seen');Object.defineProperty(navigator,'gpu',{value:{requestAdapter:()=>new Promise(resolve=>{window.resolveAdapter=()=>resolve({features:new Set(['shader-f16'])});})}});});
 await delayed.route('**/*',r=>isCF(r)?cfResponse(r):new URL(r.request().url()).origin===base?r.continue():r.abort());
 await delayedPage.goto(base+'/ai/');await delayedPage.waitForFunction(()=>typeof window.resolveAdapter==='function');
 assert.equal(await delayedPage.locator('#local-welcome').isVisible(),false,'No download prompt before device capability resolves');
 assert.equal(await delayedPage.evaluate(()=>localStorage.getItem('malguard.ai.welcome.v3')),null,'No onboarding flag is written without consent');
 await delayedPage.evaluate(()=>window.resolveAdapter());await delayed.close();console.log('PASS delayed device capability does not force a download prompt');
 const startup=await browser.newContext(),startupPage=await startup.newPage();
 await startup.addInitScript(()=>{
  localStorage.setItem('malguard.ai.welcome.v3','seen');localStorage.setItem('malguard.ai.localModel.v1','local_medium');
  Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>{await new Promise(r=>setTimeout(r,250));return {features:new Set(['shader-f16'])};}}});
 });
 await startup.route('**/api/malguard-ai/status',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,tools:{},model:{state:'configured',defaultModel:'cloud',models:[{id:'cloud',label:'Cloud fixture',state:'configured'}]}})}));
 await startupPage.goto(base+'/ai/');await startupPage.waitForFunction(()=>document.querySelector('#model option[value="local_medium"]')?.disabled===false);
 assert.equal(await startupPage.locator('#model').inputValue(),'local_medium','A faster cloud status response must not discard the saved local model');
 await startup.close();console.log('PASS saved local selection survives startup timing differences');
 for(const statusDelay of [0,400]){
  const cloud=await browser.newContext(),cloudPage=await cloud.newPage();
  await cloud.addInitScript(()=>{localStorage.setItem('malguard.ai.welcome.v3','seen');Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});});
  await cloud.route('**/api/malguard-ai/status',async r=>{await new Promise(resolve=>setTimeout(resolve,statusDelay));await r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,tools:{},model:{state:'configured',defaultModel:'llama70b',models:[{id:'llama70b',label:'Llama',state:'configured'},{id:'cf_gptoss120',label:'GPT-OSS 120B',state:'configured'}]}})});});
  await cloud.route('**/api/public-models',r=>cfResponse(r,{enabled:true}));await cloudPage.goto(base+'/ai/');await cloudPage.waitForFunction(()=>document.getElementById('model').value==='chat_granite');
  await cloudPage.locator('#model').selectOption('local_medium');await toggleSettings(cloudPage);await toggleSettings(cloudPage);assert.equal(await cloudPage.locator('#model').inputValue(),'local_medium','Explicit local choice survives rerender');
  await cloud.close();
 }
 console.log('PASS strongest configured cloud default survives capability/status ordering and preserves explicit choice');
 const autoContext=await browser.newContext({reducedMotion:'reduce'}),autoPage=await autoContext.newPage(),autoPosts=[];
 await autoContext.addInitScript(()=>{localStorage.setItem('malguard.ai.welcome.v3','seen');localStorage.setItem('malguard.ai.session.v1','synthetic-session-valid-user');window.autoWorkerCalls=[];window.Worker=class{postMessage(value){window.autoWorkerCalls.push(value);}terminate(){}};Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});});
 await autoContext.route('**/api/game-scam-guard/auth/status',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,persistentAccounts:true})}));
  await autoContext.route('**/api/game-scam-guard/auth/session',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({email:'synthetic@example.com',username:'fixture_user',expiresAt:Date.now()+600000})}));
  await autoContext.route('**/api/malguard-ai/status',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,tools:{},model:{state:'configured',defaultModel:'auto',models:[{id:'auto',label:'Auto',state:'configured'}]}})}));
 await autoContext.route('**/api/public-models',r=>cfResponse(r,{enabled:true}));
 await autoContext.route('**/api/public-model-chat',r=>{if(r.request().method()==='POST')autoPosts.push(r.request().postDataJSON());return cfResponse(r,{enabled:true});});
 await autoPage.goto(base+'/ai/');await autoPage.waitForFunction(()=>document.getElementById('model').value==='chat_granite');
 await autoPage.locator('#settings-panel > summary').click();await autoPage.locator('#permissions > summary').click();await autoPage.locator('#model-consent').check();await autoPage.locator('#settings-panel > summary').click();
 await autoPage.locator('#message').fill('سلام');await autoPage.locator('#send').click();await autoPage.locator('.answer').filter({hasText:'سلام! آماده‌ام.'}).waitFor();
 assert.equal(autoPosts.length,1);assert.equal(autoPosts[0].model,'chat_granite');assert.equal(await autoPage.evaluate(()=>autoWorkerCalls.length),0,'Cloudflare Chat must not run a local model');assert.equal(await autoPage.locator('#local-download').isVisible(),false);
 await autoContext.close();console.log('PASS default Cloudflare fast chat reaches the Worker without local downloads');
 const context=await browser.newContext(),page=await context.newPage();
 await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined});window.workerCalls=[];window.Worker=class{postMessage(data){window.workerCalls.push(data);}terminate(){}};});
 await context.route('**/*',r=>isCF(r)?cfResponse(r):new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/ai/');await page.waitForFunction(()=>document.getElementById('device-note').textContent.includes('WebGPU'));
 assert.equal(await page.locator('#local-welcome').isVisible(),false);assert.equal(await page.locator('#device-note').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);await page.locator('#open-downloads').click();await page.locator('#hub-browser').click();await page.locator('#local-offer').waitFor({state:'visible'});assert.equal(await page.locator('#offer-download-button').isDisabled(),true);assert.match(await page.locator('#offer-compatibility').innerText(),/WebGPU/);await page.locator('#local-offer').evaluate(dialog=>{window.offerClosed=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(),{once:true}));});await page.keyboard.press('Escape');await page.evaluate(()=>window.offerClosed);assert.equal(await page.evaluate(()=>workerCalls.length),0);
 await context.close();assert.deepEqual(external,[]);console.log('PASS unsupported-device guidance and zero external downloads/uploads');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
