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
const browser=await chromium.launch(launchOptions('chromium'));
const output=process.env.MALGUARD_PREVIEW_DIR||'test-results/malguard-ai-local';await mkdir(output,{recursive:true});
try{
 for(const width of [360,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort();});
  await context.addInitScript(()=>{
   localStorage.setItem('malguard-language','fa');
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
  await page.goto(base+'/ai/');await page.locator('#local-welcome').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>workerCalls.length),0,'First visit must not fetch model weights');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.match(await page.locator('#welcome-info').innerText(),/بدون سقف پیام روزانه/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([390,1280].includes(width))await page.screenshot({path:path.join(output,`welcome-${width}.png`)});
  await page.locator('#local-welcome button[value="later"]').click();
  assert.equal(await page.locator('#model').isVisible(),true);assert.equal(await page.locator('#composer #model').count(),1);assert.equal(await page.locator('#model-toolbar').count(),0);assert.equal(await page.locator('#device-note').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);assert.equal(await page.locator('#settings-panel').getAttribute('open'),null);
  assert.equal(await page.locator('#model').inputValue(),'local_fast');
  if([390,1280].includes(width))await page.screenshot({path:path.join(output,`quiet-${width}.png`)});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.locator('#local-welcome').isVisible(),false,'Skip persists across reload');
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
  assert.match(await page.locator('#device-note').textContent(),/آماده/);
  assert.deepEqual(await page.evaluate(()=>workerCalls.map(c=>c.operation)),['prepare','prepare','prepare']);
  assert.equal(posts.length,0,'Preparing and selecting models must not submit conversation');
  await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('dir'),'ltr');assert.match(await page.locator('#device-note').textContent(),/Ready/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.reload();await page.waitForFunction(()=>!document.getElementById('manage-models').disabled);
  assert.equal(await page.locator('#model').inputValue(),'local_medium','The chosen local model persists without downloading on reload');
  assert.equal(await page.evaluate(()=>workerCalls.length),0);
  await context.close();console.log(`PASS welcome, skip, explicit download, cancel, failure/retry, active model and RTL/LTR at ${width}px (mock worker)`);
 }
 const delayed=await browser.newContext(),delayedPage=await delayed.newPage();
 await delayed.addInitScript(()=>{localStorage.setItem('malguard.ai.welcome.v2','seen');Object.defineProperty(navigator,'gpu',{value:{requestAdapter:()=>new Promise(resolve=>{window.resolveAdapter=()=>resolve({features:new Set(['shader-f16'])});})}});});
 await delayed.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await delayedPage.goto(base+'/ai/');await delayedPage.locator('#local-welcome').waitFor({state:'visible'});
 assert.equal(await delayedPage.evaluate(()=>localStorage.getItem('malguard.ai.welcome.v3')),'seen','The new introduction appears even after an older welcome was dismissed');
 await delayedPage.evaluate(()=>window.resolveAdapter());await delayedPage.keyboard.press('Escape');await delayed.close();console.log('PASS introduction appears before capability resolution and upgrades the welcome key');
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
  await cloudPage.goto(base+'/ai/');await cloudPage.waitForFunction(()=>document.getElementById('model').value==='cf_gptoss120');
  await cloudPage.locator('#model').selectOption('local_medium');await cloudPage.locator('#language').click();assert.equal(await cloudPage.locator('#model').inputValue(),'local_medium','Explicit local choice survives rerender');
  await cloud.close();
 }
 console.log('PASS strongest configured cloud default survives capability/status ordering and preserves explicit choice');
 const autoContext=await browser.newContext({reducedMotion:'reduce'}),autoPage=await autoContext.newPage(),autoPosts=[];
 await autoContext.addInitScript(()=>{localStorage.setItem('malguard.ai.welcome.v3','seen');localStorage.setItem('malguard.ai.permissions.v1',JSON.stringify({}));window.autoWorkerCalls=[];window.Worker=class{postMessage(value){window.autoWorkerCalls.push(value);}terminate(){}};Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});});
 await autoContext.route('**/api/malguard-ai/status',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,tools:{},model:{state:'configured',defaultModel:'auto',models:[{id:'auto',label:'Auto',state:'configured'},{id:'cf_gptoss120',label:'GPT-OSS',state:'configured'}]}})}));
 await autoContext.route('**/api/malguard-ai/chat',r=>{autoPosts.push(r.request().postDataJSON());return r.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({result:{generated:{text:'سلام! آماده‌ام.',provider:'workers_ai_rest',selectedModel:'cf_qwen3',requestedModel:'auto',model:'Qwen3'}}})+'\n'});});
 await autoPage.goto(base+'/ai/');await autoPage.waitForFunction(()=>document.getElementById('model').value==='auto');
 await autoPage.locator('#settings-panel > summary').click();await autoPage.locator('#permissions > summary').click();await autoPage.locator('#model-consent').check();await autoPage.locator('#settings-panel > summary').click();
 await autoPage.locator('#message').fill('سلام');await autoPage.locator('#send').click();await autoPage.locator('.answer').filter({hasText:'سلام! آماده‌ام.'}).waitFor();
 assert.equal(autoPosts.length,1);assert.equal(autoPosts[0].model,'auto');assert.equal(await autoPage.evaluate(()=>autoWorkerCalls.length),0,'Cloud Auto must not download or execute a local model');assert.equal(await autoPage.locator('#local-download').isVisible(),false);
 await autoContext.close();console.log('PASS cloud Auto short greetings reach the server without local downloads');
 const context=await browser.newContext(),page=await context.newPage();
 await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined});window.workerCalls=[];window.Worker=class{postMessage(data){window.workerCalls.push(data);}terminate(){}};});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/ai/');await page.waitForFunction(()=>document.getElementById('device-note').textContent.includes('WebGPU'));
 assert.equal(await page.locator('#local-welcome').isVisible(),true);assert.equal(await page.locator('#device-note').isVisible(),false);assert.equal(await page.locator('#connection').isVisible(),false);await page.locator('#local-welcome button[value="choose"]').click();await page.locator('#local-offer').waitFor({state:'visible'});assert.equal(await page.locator('#offer-download-button').isDisabled(),true);assert.match(await page.locator('#offer-compatibility').innerText(),/WebGPU/);await page.locator('#local-offer').evaluate(dialog=>{window.offerClosed=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(),{once:true}));});await page.keyboard.press('Escape');await page.evaluate(()=>window.offerClosed);assert.equal(await page.evaluate(()=>workerCalls.length),0);
 await context.close();assert.deepEqual(external,[]);console.log('PASS unsupported-device guidance and zero external downloads/uploads');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
