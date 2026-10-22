// Compact UI, complete localization and real engine integration on authored data.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createApp} from '../services/game-scam-guard/server/app.js';
import {scanSite} from '../services/game-scam-guard/server/scanner.js';
import {stepScanJob,prepareJobPreview} from '../services/game-scam-guard/server/scan-jobs.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZV0AAAAASUVORK5CYII=';
const html=Buffer.from('<html><title>Owned UI fixture</title><body><p>Public information</p><a href="/one">One</a><a href="/two">Two</a><a href="/three">Three</a><a href="/download.zip">Excluded download</a><script>navigator.serviceWorker.register("/fixture-sw.js");</script></body></html>');
let childStatus='limited',hold=false,release,previewCalls=0;
const api=createApp({emailAuth:{enabled:true,status:{},availability:async()=>({email:'available',username:'available'}),start:async()=>({verificationToken:'owned-ticket'}),verify:async()=>({sessionToken:'owned-session'}),session:()=>({email:'player@example.com',firstName:'Fixture'})},providerStatus:()=>({urlhaus:true,openphish:false}),
 scanSite:async(url,options)=>{await new Promise(resolve=>setTimeout(resolve,150));return scanSite(url,{...options,validate:async address=>{if(['127.0.0.1','169.254.169.254'].includes(address.hostname))throw Object.assign(new Error('Private addresses'),{status:400});},lookup:async()=>({status:'not_found',message:'Owned threat source fixture',sources:[{provider:'urlhaus',status:'not_found',message:'Owned fixture'},{provider:'openphish',status:'unconfigured',message:'Disabled'}]}),transport:async address=>({url:address.href,status:200,headers:{'content-type':'text/html'},bytes:html,redirects:[{from:address.href,to:new URL('/hop',address).href,status:302},{from:new URL('/hop',address).href,to:address.href,status:302}]}),preview:async()=>({status:'done',image,detail:'Owned fixture snapshot'})});},
 preparePreview:job=>prepareJobPreview(job,{transport:async url=>({url,bytes:html}),preview:async()=>{previewCalls++;return {status:'done',image,detail:'Owned fixture snapshot'};}}),
 stepJob:(input,options)=>stepScanJob(input,{...options,inspect:async target=>{if(hold&&target.url.endsWith('/two'))await new Promise(resolve=>{release=resolve;});return {...target,status:childStatus,detail:'Owned fixture destination'};}})
});
const app=express();app.use('/api/game-scam-guard',(req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});app.use(express.static('_site'));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');let browser,page;const errors=[];const evidence={passed:[],viewports:[]};
await mkdir('test-results',{recursive:true});
function record(value){evidence.passed.push(value);console.log('PASS:',value);}
async function assertLanguage(locale){
 const bad=await page.evaluate(locale=>{
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),bad=[];
  while(walker.nextNode()){
   const node=walker.currentNode,el=node.parentElement,text=node.nodeValue.trim();if(!text||!el||el.closest('script,style,svg,[data-original],[dir="ltr"],code,.g-brand'))continue;
   const range=document.createRange();range.selectNodeContents(node);if(!range.getClientRects().length)continue;
   if(locale==='en'){if(/[\u0600-\u06ff]/.test(text))bad.push(text);}
   else{const cleaned=text.replace(/GameScam Guard|MalGuard|URLhaus|OpenPhish|\b(?:EN|FA)\b|you@example\.com|Player_Guard/g,'');if(/[a-z]/i.test(cleaned))bad.push(text);}
  }
  return bad;
 },locale);
 assert.deepEqual(bad,[],`Visible ${locale} interface must not contain untranslated strings`);
}
async function assertReadable(selector){
 const bad=await page.locator(selector).evaluateAll(nodes=>{
  const rgb=value=>{const parts=value.match(/[\d.]+/g)||[];return parts.slice(0,3).map(Number);};
  const luminance=channels=>channels.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);
  return nodes.filter(node=>node.getClientRects().length).flatMap(node=>{const fg=rgb(getComputedStyle(node).color);let current=node,bg;while(current){const color=getComputedStyle(current).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent'){bg=rgb(color);break;}current=current.parentElement;}const a=luminance(fg),b=luminance(bg||[0,0,0]),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return contrast<4.5?[{text:node.textContent.trim().slice(0,80),contrast}]:[];});
 });assert.deepEqual(bad,[],'Primary report, account and diagnostic labels need readable contrast');
}
async function details(panel){
 const root=page.locator('.g-report-details');if(await root.getAttribute('open')===null)await root.locator(':scope > summary').click();
 await root.getByRole('tab',{name:panel,exact:true}).click();
}
try{
 browser=await chromium.launch({...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/game-scam-guard/`);
 assert.equal(await page.locator('html').getAttribute('lang'),'en');await assertLanguage('en');
 assert.equal(await page.locator('.g-brand-logo').evaluate(img=>img.complete&&img.naturalWidth===192),true);
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:820,height:1080},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  assert.ok(size.scrollWidth<=size.width,'No horizontal scroll');assert.ok(size.scrollHeight<=size.height*1.05,'The initial screen fits without a long landing page');evidence.viewports.push({...viewport,initialHeight:size.scrollHeight});
  await page.screenshot({path:`test-results/game-scam-compact-empty-${viewport.width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Sign in or manage account',exact:true}).click();await page.getByRole('heading',{name:'Create your account'}).waitFor();await assertLanguage('en');await assertReadable('.account-modal label,.account-modal h2');assert.equal(await page.locator('.google-button').count(),0);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByLabel('Website link').fill('https://example.com/');await page.getByRole('button',{name:'Start scan',exact:true}).click();await page.locator('.verdict.limited').waitFor();
 assert.equal(await page.locator('.g-report-details').getAttribute('open'),null);
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:820,height:1080},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);const metrics=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(metrics.sw<=metrics.w);assert.ok(metrics.sh<=metrics.h*1.3,'Default completed report stays compact');await page.screenshot({path:`test-results/game-scam-compact-result-${viewport.width}.png`,fullPage:true});
 }
 record('compact initial and completed screens at 320/390/820/1440px; details closed by default');
 await page.setViewportSize({width:390,height:844});
 for(const panel of ['Overview','Evidence','Coverage','Linked pages','Threat sources']){await details(panel);await assertLanguage('en');}
 await details('Threat sources');assert.equal(await page.locator('.g-url-sources').count(),2);assert.equal(await page.locator('.g-url-sources p[dir=ltr]').last().innerText(),'https://example.com/hop');
 await details('Coverage');assert.equal(await page.locator('.analysis-modules article').count(),20);await assertReadable('.analysis-modules b,.g-intro h1');record('20 actual analysis modules and all English report panels');
 await page.getByRole('button',{name:'Change language',exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),'fa');
 for(const panel of ['خلاصه','شواهد','پوشش','صفحه‌های مرتبط','منابع تهدید']){await details(panel);await assertLanguage('fa');}
 await page.getByRole('button',{name:'ورود یا مدیریت حساب',exact:true}).click();await page.getByRole('heading',{name:'حساب خود را بسازید'}).waitFor();await assertLanguage('fa');
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:820,height:1080}]){await page.setViewportSize(viewport);assert.equal(await page.locator('.account-modal').evaluate(el=>el.scrollWidth>el.clientWidth),false);}
 await page.getByLabel('نام',{exact:true}).fill('علی');await page.getByLabel('نام خانوادگی').fill('محمدی');await page.getByLabel('تاریخ تولد').fill('2000-01-01');await page.getByLabel('نام کاربری',{exact:true}).fill('player_guard');await page.getByLabel('نشانی ایمیل',{exact:true}).fill('player@example.com');await page.getByLabel('رمز عبور',{exact:true}).fill('StrongPass1');await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('StrongPass1');
 await page.getByRole('button',{name:'ارسال کد تأیید',exact:true}).click();await page.getByRole('heading',{name:'کد خود را وارد کنید'}).waitFor();await assertLanguage('fa');await page.getByRole('button',{name:'بستن',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'خودآزمایی',exact:true}).click();await assertLanguage('fa');await page.getByRole('button',{name:'اجرای خودآزمایی',exact:true}).click();await page.getByRole('heading',{name:'خودآزمایی موفق بود'}).waitFor();await page.locator('.g-self-test > details > summary').click();await assertLanguage('fa');await assertReadable('.g-test-checks>div>span:first-child');assert.equal(await page.locator('.g-test-checks>div').count(),42);await page.screenshot({path:'test-results/game-scam-self-test-fa.png',fullPage:true});
 await page.getByRole('button',{name:'تنظیمات',exact:true}).click();await assertLanguage('fa');await page.getByRole('button',{name:'تاریخچه',exact:true}).click();await assertLanguage('fa');record('complete Persian report, account signup/code, self-test, settings and history; no mixed UI text');
 await page.getByRole('button',{name:'تغییر زبان',exact:true}).click();await page.getByRole('button',{name:'Scan',exact:true}).click();await page.locator('.g-report-details > summary').click();
 hold=true;await page.locator('.advanced-prompt button').click();await page.getByRole('button',{name:'Scan public pages',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')==='1');assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'3');await page.locator('.scan-activity').screenshot({path:'test-results/game-scam-compact-progress.png'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('.active-scan-return').waitFor();await page.locator('.active-scan-return').click();hold=false;release();await page.locator('.assessment-comparison').waitFor();await page.waitForFunction(()=>!localStorage.getItem('guard-pending-job'));await assertLanguage('en');record('streamed progress, navigation during scanning and preserved initial assessment');
 for(const status of ['unavailable','danger']){
  childStatus=status;await page.getByLabel('Website link').fill('https://example.com/');await page.getByRole('button',{name:'Start scan',exact:true}).click();await page.locator('.verdict.limited').waitFor();await page.locator('.advanced-prompt button').click();await page.getByRole('button',{name:'Scan public pages',exact:true}).click();await page.locator('.verdict.'+status).waitFor();const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('gamescam-guard-history-v1'))[0]);assert.equal(report.initialAssessment.status,'limited');assert.equal(report.jobSummary.excluded,1);await assertLanguage('en');
 }
 record('additional threat and unavailable coverage explain changed expanded verdicts');
 const pending=await page.evaluate(async()=>{const post=async(endpoint,body)=>{const response=await fetch('/api/game-scam-guard/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error('Fixture request failed');return response.json();};const report=await post('scan',{url:'https://example.com/',mode:'basic'});const job=await post('jobs/start',{id:report.id,token:report.scanToken,mode:'advanced',consent:true});const saved={id:job.id,token:job.token,mode:job.mode,next:job.next,total:job.targets.length};localStorage.setItem('guard-pending-job',JSON.stringify(saved));return saved;});assert.equal(pending.total,3);childStatus='limited';
 await page.reload();await page.getByRole('tab',{name:'Advanced website scan',exact:true}).click();await page.getByLabel('Website link').fill('https://second.example.com/');await page.getByRole('button',{name:'Start scan',exact:true}).click();await page.getByRole('button',{name:'Not now',exact:true}).click();await details('Overview');await page.locator('.browser-preview > summary').click();assert.equal(await page.locator('.browser-preview img').count(),1);await page.locator('.g-resume button').click();await page.locator('.assessment-comparison').waitFor();await details('Overview');await page.locator('.browser-preview > summary').click();assert.equal(await page.locator('.browser-preview img').count(),0);record('resumed queue cannot borrow an unrelated site screenshot');
 await page.getByRole('button',{name:'Self-test',exact:true}).click();await page.getByRole('button',{name:'Run self-test',exact:true}).click();await page.getByRole('heading',{name:'Self-test passed',exact:true}).waitFor();await assertLanguage('en');
 assert.deepEqual(errors,[]);evidence.status='passed';record('no browser runtime errors; English self-test and real engine fixture diagnostics');
}catch(error){evidence.status='failed';evidence.error=error.message;evidence.errors=errors;if(page){await page.screenshot({path:'test-results/game-scam-compact-failure.png',fullPage:true}).catch(()=>{});evidence.body=await page.locator('body').innerText().catch(()=>'');}console.error(error.stack);process.exitCode=1;}
finally{release?.();await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile('test-results/game-scam-compact.json',JSON.stringify(evidence,null,2));}
