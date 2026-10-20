import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const app=express();app.use(express.static('_site'));const server=app.listen(0,'127.0.0.1');await once(server,'listening');
let browser;const evidence={status:'running',localOnly:true,viewports:[],videos:[]};
await mkdir('test-results',{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname.includes('/api/game-scam-guard/'))return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('/health')?{status:'ok',providers:{urlhaus:false,openphish:false}}:{configured:false})});return route.continue();});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const locale of ['en','fa']){
  await page.goto(base+'/game-scam-guard/');
  if(await page.locator('html').getAttribute('lang')!==locale)await page.getByRole('button',{name:'Change language',exact:true}).click();
  await page.getByRole('button',{name:locale==='en'?'Help':'راهنما',exact:true}).click();
  await page.getByRole('link',{name:locale==='en'?'Guide, training video and technical articles':'راهنما، فیلم آموزشی و مقاله‌های فنی',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
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
   await video.play();await new Promise(resolve=>setTimeout(resolve,600));video.pause();return {duration:video.duration,width:video.videoWidth,height:video.videoHeight,time:video.currentTime,error:video.error?.code||null};
  });assert.equal(video.error,null);assert.ok(video.duration>=30&&video.duration<=120);assert.ok(video.time>0);assert.equal(video.width,1280);evidence.videos.push({locale,...video});
  const source=await page.locator('video source').getAttribute('src');const range=await context.request.get(new URL(source,page.url()).href,{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);assert.match(range.headers()['content-type'],/video\/mp4/);
  const report=await context.request.get(new URL('./evaluation.json',page.url()).href);assert.equal(report.status(),200);const data=await report.json();assert.equal(data.summary.cases,34);assert.equal(data.summary.failed,0);assert.equal(data.independentEvaluation,false);
  const paper=await context.request.get(new URL('./technical-report.md',page.url()).href);assert.equal(paper.status(),200);assert.match(await paper.text(),/not a peer-reviewed paper/);
  await page.getByRole('link',{name:locale==='en'?'Back to the app':'بازگشت به برنامه',exact:true}).click();await page.locator('.g-brand-logo').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),locale);
 }
 assert.deepEqual(errors,[]);evidence.status='passed';console.log('PASS: both guides, two localized articles, 20 check descriptions, local report downloads, MP4 decoding/playback/range requests, both help links and four viewport sizes.');
}catch(error){evidence.status='failed';evidence.error=error.message;process.exitCode=1;console.error(error.stack);}
finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile('test-results/game-scam-learning.json',JSON.stringify(evidence,null,2));}
