// End-to-end UI regression using authored HTML and an owned local API.
// No third-party page, account, cloud VM or suspicious executable is used.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../services/game-scam-guard/server/app.js';
import {scanSite} from '../services/game-scam-guard/server/scanner.js';
import {stepScanJob,prepareJobPreview} from '../services/game-scam-guard/server/scan-jobs.js';

const html=Buffer.from('<html><title>Owned UI fixture</title><body><h1>Owned UI fixture</h1><a href="/public-page">Public page</a><a href="/public-page-two">Second page</a><a href="/public-page-three">Third page</a><a href="/download.zip">Download excluded</a></body></html>');
let childStatus='limited',previewCalls=0,holdQueue=true,releaseQueue;
const app=express();
const api=createApp({
  emailAuth:{enabled:true,status:{}},providerStatus:()=>({urlhaus:false}),
  scanSite:async(url,options)=>{
    await new Promise(resolve=>setTimeout(resolve,250));
    return scanSite(url,{...options,validate:async()=>{},lookup:async()=>({status:'not_found',message:'Fixture URL not listed; not a safety guarantee.'}),transport:async address=>({url:address.href,status:200,headers:{'content-type':'text/html'},bytes:html,redirects:[]}),preview:async()=>({status:'done',detail:'Authored second-site snapshot',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZV0AAAAASUVORK5CYII='})});
  },
  preparePreview:job=>prepareJobPreview(job,{transport:async url=>({url,bytes:html}),preview:async()=>{previewCalls++;return {status:'done',detail:'Authored fixture snapshot; no live video.',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZV0AAAAASUVORK5CYII='};}}),
  stepJob:(input,options)=>stepScanJob(input,{...options,inspect:async target=>{if(holdQueue&&target.url.endsWith('/public-page-two'))await new Promise(resolve=>{releaseQueue=resolve;});await new Promise(resolve=>setTimeout(resolve,150));return {...target,status:childStatus,detail:childStatus==='unavailable'?'Fixture page did not respond.':'Authored fixture destination inspected.'};}}),
});
app.use('/api/game-scam-guard',(req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});
app.use(express.static('_site'));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
  browser=await chromium.launch({...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game-scam-guard/`);
  await mkdir('test-results',{recursive:true});
  for(const status of ['limited','unavailable','danger']){
    childStatus=status;
    await page.getByLabel('Website link').fill('https://example.com/');
    await page.getByRole('button',{name:'Start scan',exact:true}).click();
    await page.getByRole('heading',{name:'Website scan in progress'}).waitFor();
    await page.getByRole('heading',{name:'Owned UI fixture',exact:true}).waitFor();
    assert.equal(await page.locator('.verdict.limited').count(),1);
    await page.locator('.advanced-prompt button').click();
    await page.getByRole('button',{name:'Scan public pages',exact:true}).click();
    if(status==='limited'){
      await page.waitForFunction(()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')==='1');
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'3');
      await page.locator('.scan-activity').screenshot({path:'test-results/game-scam-live-progress.png'});
      await page.getByRole('button',{name:'Open menu',exact:true}).click();
      await page.getByRole('button',{name:'Settings',exact:true}).click();
      await page.locator('.active-scan-return').waitFor();
      await page.locator('.active-scan-return').click();
      holdQueue=false;releaseQueue();
    }
    await page.locator('.assessment-comparison').waitFor();
    assert.equal(await page.locator(`.verdict.${status}`).count(),1);assert.equal(await page.locator('.verdict .status-badge').isVisible(),true);
    assert.equal(await page.locator('.assessment-comparison .status-badge.limited').first().count(),1);
    const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('gamescam-guard-history-v1'))[0]);
    assert.equal(report.initialAssessment.status,'limited');
    assert.equal(report.jobSummary.excluded,1);assert.equal(report.jobSummary.omitted,0);
    assert.equal(report.inspectionLayers.length,15);assert.equal(report.preview.status,'done');assert.equal(await page.locator('.browser-preview img').count(),1);
    if(status==='unavailable')await page.getByText('Some linked pages could not be inspected. This is a coverage gap, not evidence of malware.',{exact:true}).waitFor();
    await page.locator('.inspection-layers summary').click();
    assert.equal(await page.locator('.inspection-layers article').count(),15);
    for(const viewport of [{width:320,height:740},{width:390,height:844},{width:820,height:1080},{width:1440,height:1000}]){
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Report must fit the viewport');
      assert.equal(await page.locator('.report-card').evaluate(el=>el.scrollWidth>el.clientWidth),false,'Long evidence must wrap');
    }
    await page.setViewportSize({width:390,height:844});
    await mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/game-scam-extended-${status}.png`,fullPage:true});
  }
  await page.getByLabel('Website link').fill('http://example.com/');
  await page.getByRole('button',{name:'Start scan',exact:true}).click();
  await page.locator('.signal.warning').waitFor();
  const warningBackground=await page.locator('.signal.warning').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.notEqual(warningBackground,'rgb(255, 252, 243)','Warning evidence must not retain a pale background under light dark-theme text');
  assert.equal(await page.locator('.verdict .status-badge').isVisible(),true);
  await page.screenshot({path:'test-results/game-scam-warning-mobile.png',fullPage:false});
  assert.equal(previewCalls,3);assert.deepEqual(errors,[]);
  // Persist a queue for site A, then scan site B with a screenshot. Resuming A
  // must never copy B's screenshot into A's evidence report.
  const pending=await page.evaluate(async()=>{
    const post=async(endpoint,body)=>{const response=await fetch('/api/game-scam-guard/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error('Fixture request failed');return response.json();};
    const report=await post('scan',{url:'https://example.com/',mode:'basic'});
    const job=await post('jobs/start',{id:report.id,token:report.scanToken,mode:'advanced',consent:true});
    const saved={id:job.id,token:job.token,mode:job.mode,next:job.next,total:job.targets.length};
    localStorage.setItem('guard-pending-job',JSON.stringify(saved));return saved;
  });
  assert.equal(pending.total,3);childStatus='limited';
  await page.reload();
  await page.getByRole('tab',{name:/Advanced website scan/}).click();
  await page.getByLabel('Website link').fill('https://second.example.com/');
  await page.getByRole('button',{name:'Start scan',exact:true}).click();
  await page.getByRole('button',{name:'Not now',exact:true}).click();
  assert.equal(await page.locator('.browser-preview img').count(),1);
  await page.locator('button').filter({hasText:/Resume saved queue/}).click();
  await page.locator('.assessment-comparison').waitFor();
  await page.waitForFunction(()=>!localStorage.getItem('guard-pending-job'));
  assert.equal(await page.locator('.browser-preview img').count(),0,'Resumed site A must not show site B screenshot');
  const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('gamescam-guard-history-v1'))[0]);
  assert.equal(resumed.domain,'example.com');assert.deepEqual(errors,[]);
  console.log('PASS: streamed per-target progress, navigation during scanning, cross-site queue screenshot isolation, basic-to-advanced browser upgrade, preserved original verdict, excluded downloads and explained coverage/threat changes at 320/390/820/1440px.');
}finally{
  releaseQueue?.();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
