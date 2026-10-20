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

const html=Buffer.from('<html><title>Owned UI fixture</title><body><h1>Owned UI fixture</h1><a href="/public-page">Public page</a><a href="/download.zip">Download excluded</a></body></html>');
let childStatus='limited',previewCalls=0;
const app=express();
const api=createApp({
  emailAuth:{enabled:true,status:{}},providerStatus:()=>({urlhaus:false}),
  scanSite:async(url,options)=>{
    await new Promise(resolve=>setTimeout(resolve,250));
    return scanSite(url,{...options,validate:async()=>{},lookup:async()=>({status:'not_found',message:'Fixture URL not listed; not a safety guarantee.'}),transport:async address=>({url:address.href,status:200,headers:{'content-type':'text/html'},bytes:html,redirects:[]})});
  },
  preparePreview:job=>prepareJobPreview(job,{transport:async url=>({url,bytes:html}),preview:async()=>{previewCalls++;return {status:'done',detail:'Authored fixture snapshot; no live video.',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZV0AAAAASUVORK5CYII='};}}),
  stepJob:(input,options)=>stepScanJob(input,{...options,inspect:async target=>({...target,status:childStatus,detail:childStatus==='unavailable'?'Fixture page did not respond.':'Authored fixture destination inspected.'})}),
});
app.use('/api/game-scam-guard',(req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});
app.use(express.static('_site'));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
  browser=await chromium.launch({args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game-scam-guard/`);
  for(const status of ['limited','unavailable','danger']){
    childStatus=status;
    await page.getByLabel('Website link').fill('https://example.com/');
    await page.getByRole('button',{name:'Start scan',exact:true}).click();
    await page.getByRole('heading',{name:'Website scan in progress'}).waitFor();
    await page.getByRole('heading',{name:'Owned UI fixture',exact:true}).waitFor();
    assert.equal(await page.locator('.verdict.limited').count(),1);
    await page.locator('.advanced-prompt button').click();
    await page.getByRole('button',{name:'Scan public pages',exact:true}).click();
    await page.locator('.assessment-comparison').waitFor();
    assert.equal(await page.locator(`.verdict.${status}`).count(),1);
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
  assert.equal(previewCalls,3);assert.deepEqual(errors,[]);
  console.log('PASS: visible scan activity, basic-to-advanced browser upgrade, original verdict preservation, excluded downloads, explained coverage/threat changes and 15 evidence categories at 320/390/820/1440px.');
}finally{
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
