import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const app=express();app.use(express.static('_site'));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const evidence={status:'running',localOnly:true,viewports:[],videos:[]};
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch({...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname.includes('/api/game-scam-guard/'))return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/health')?{status:'ok',providers:{urlhaus:false,openphish:false}}:{configured:false})});return route.continue();});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const locale of ['en','fa']){
  await page.goto(base+'/game-scam-guard/');
  if(await page.locator('html').getAttribute('lang')!==locale)await page.getByRole('button',{name:'Change language',exact:true}).click();
  await page.getByRole('button',{name:locale==='en'?'Help':'راهنما',exact:true}).click();
  await page.getByRole('link',{name:locale==='en'?'Guide, training video and technical articles':'راهنما، فیلم آموزشی و مقاله‌های فنی',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#articles article').count(),2);assert.equal(await page.locator('.checks>li').count(),20);
  const wrong=await page.evaluate(locale=>{
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),bad=[];
   while(walker.nextNode()){const node=walker.currentNode,el=node.parentElement,text=node.textContent.trim();if(!text||el.closest('script,style')||el.closest(locale==='en'?'[lang=fa]':'[lang=en]'))continue;const cleaned=text.replace(/GameScam Guard/g,'');if(locale==='en'?/[\u0600-\u06ff]/.test(cleaned):/[a-z]/i.test(cleaned))bad.push(text);}
   return bad;
  },locale);assert.deepEqual(wrong,[],'Guide labels, articles and troubleshooting must be localized');
  for(const size of [{width:320,height:740},{width:390,height:844},{width:820,height:1080},{width:1440,height:1000}]){
   await page.setViewportSize(size);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow in the guide');
   evidence.viewports.push({locale,...size});if(size.width===390)await page.screenshot({path:`test-results/game-scam-guide-${locale}.png`,fullPage:false});
  }
  const video=await page.locator('video').evaluate(async video=>{
   video.load();await new Promise((resolve,reject)=>{if(video.readyState>=1)return resolve();video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('Training video failed to load')),{once:true});});
   const audio=new AudioContext(),meter=audio.createAnalyser();audio.createMediaElementSource(video).connect(meter);meter.connect(audio.destination);video.__learningAudio={audio,meter};await audio.resume();
   await video.play();let peak=0;for(let i=0;i<15;i++){await new Promise(resolve=>setTimeout(resolve,80));const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);peak=Math.max(peak,Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length));}video.pause();return {duration:video.duration,width:video.videoWidth,height:video.videoHeight,time:video.currentTime,audioPeakRms:peak,error:video.error?.code||null};
  });assert.equal(video.error,null);assert.ok(video.duration>=30&&video.duration<=120);assert.ok(video.time>0);assert.equal(video.width,1280);assert.ok(video.audioPeakRms>.005,'The narrated MP4 must decode a real audio signal');evidence.videos.push({locale,...video});
  const source=await page.locator('video source[type="video/mp4"]').getAttribute('src');const range=await context.request.get(new URL(source,page.url()).href,{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);assert.match(range.headers()['content-type'],/video\/mp4/);
  const fallback=await page.locator('video source[type="video/webm"]').getAttribute('src');
  const fallbackVideo=await page.locator('video').evaluate(async(video,src)=>{
   video.src=src;video.load();await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('Open-codec fallback failed to load')),{once:true});});
   await video.play();const meter=video.__learningAudio.meter;let peak=0;for(let i=0;i<15;i++){await new Promise(resolve=>setTimeout(resolve,80));const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);peak=Math.max(peak,Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length));}video.pause();return {duration:video.duration,time:video.currentTime,audioPeakRms:peak};
  },fallback);assert.ok(fallbackVideo.duration>=30&&fallbackVideo.time>0,'Open-codec fallback must actually play');assert.ok(fallbackVideo.audioPeakRms>.005,'The narrated WebM must decode a real audio signal');evidence.videos.push({locale,format:'webm',...fallbackVideo});
  const report=await context.request.get(new URL('./evaluation.json',page.url()).href);assert.equal(report.status(),200);const data=await report.json();assert.equal(data.summary.cases,34);assert.equal(data.summary.failed,0);assert.equal(data.independentEvaluation,false);
  const paper=await context.request.get(new URL('./technical-report.md',page.url()).href);assert.equal(paper.status(),200);assert.match(await paper.text(),/not a peer-reviewed paper/);
  const other=locale==='en'?'fa':'en';
  const languageMenu=page.getByRole('navigation',{name:locale==='en'?'Video language':'زبان فیلم',exact:true});
  assert.equal(await languageMenu.locator('[aria-current="page"]').getAttribute('lang'),'en');
  await page.locator('video').evaluate(video=>video.play());
  if(locale==='en'){assert.equal(await languageMenu.getByRole('link',{name:'فارسی',exact:true}).count(),0);await page.goto(base+'/game-scam-guard/learn/fa.html#movie');}else await languageMenu.getByRole('link',{name:'English',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),other);
  assert.equal(new URL(page.url()).hash,'#movie','Changing video language must keep the player in view');
  assert.match(await page.locator('video source[type="video/mp4"]').getAttribute('src'),new RegExp(`training-${other}\\.mp4`));
  assert.equal(await page.locator('video').evaluate(video=>video.paused&&!video.muted&&video.volume===1),true,'The new language is ready to play with sound; the previous player must not keep playing');
  await page.getByRole('link',{name:other==='fa'?'بازگشت به برنامه':'Back to the app',exact:true}).click();
  await page.locator('.g-brand-logo').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en','The app stays English after visiting a guide');
  await page.goto(base+'/game-scam-guard/learn/'+(locale==='fa'?'fa.html':'index.html'));
  await page.getByRole('link',{name:locale==='en'?'Back to the app':'بازگشت به برنامه',exact:true}).click();await page.locator('.g-brand-logo').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 }
 await page.goto(base+'/game-scam-guard/');
 await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('App service worker did not become ready')),10000))]));
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:10000});
 await page.goto(base+'/game-scam-guard/learn/fa.html');
 const cachedApp=await page.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(name=>name.startsWith('gamescam-guard-site-')));const response=await cache.match('/game-scam-guard/');return response?.text();});
 assert.match(cachedApp,/id=["']root["']/,'Visiting a guide must preserve the cached app shell');
 await context.setOffline(true);
 try{
  await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'fa','The Persian guide must retain its own offline document');
  await page.getByRole('link',{name:'بازگشت به برنامه',exact:true}).click();await page.locator('.g-brand-logo').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'en','Returning from an offline guide opens the English app');
 }finally{await context.setOffline(false);}
 evidence.offlineGuideAndAppShell='passed';
 assert.deepEqual(errors,[]);evidence.status='passed';console.log('PASS: both guides, two localized articles, 20 check descriptions, local report downloads, MP4 decoding/playback/range requests, both help links, player-language switching in both directions, persisted app language, offline guide/app separation and four viewport sizes.');
}catch(error){evidence.status='failed';evidence.error=error.message;process.exitCode=1;console.error(error.stack);}
finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile('test-results/game-scam-learning.json',JSON.stringify(evidence,null,2));}
