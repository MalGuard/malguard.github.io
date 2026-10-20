// Record the real UI. All pages, URL reports and credentials below are inert
// training fixtures. No production email, threat lookup or browser VM is used.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createApp} from '../services/game-scam-guard/server/app.js';
import {scanSite} from '../services/game-scam-guard/server/scanner.js';
import {inspectJobTarget,stepScanJob} from '../services/game-scam-guard/server/scan-jobs.js';
const output=new URL('../services/game-scam-guard/public/learn/',import.meta.url);
const art=Buffer.from('<title>Owned training page</title><p>Harmless authored tutorial.</p><a href="/linked-sample">Training destination</a>');
const validate=async address=>{assert.equal(address.hostname,'example.com');};
const lookup=async url=>{
 await pause(180);
 if(url.includes('provider-unavailable'))throw new Error('Simulated source outage');
 const listed=url.includes('linked-sample');
 return {status:listed?'listed':'not_found',message:'Simulated training source observation',sources:[{provider:'urlhaus',status:listed?'listed':'not_found',message:'Simulated training source observation'},{provider:'openphish',status:'unconfigured',message:'Optional training source disabled'}]};
};
const transport=async address=>{
 await pause(750);const url=String(address),linked=url.includes('linked-sample'),outage=url.includes('provider-unavailable');
 return {url:linked||outage?url:'https://example.com/landing',status:200,headers:{'content-type':'text/html'},bytes:linked||outage?Buffer.from('<title>Harmless training destination</title><p>No executable content.</p>'):art,
 redirects:linked||outage?[]:[{from:url,to:'https://example.com/hop',status:302},{from:'https://example.com/hop',to:'https://example.com/landing',status:302}]};
};
const api=createApp({emailAuth:{enabled:false,status:{}},providerStatus:()=>({urlhaus:true,openphish:false}),
 scanSite:(url,options)=>scanSite(url,{...options,validate,lookup,transport,preview:async()=>({status:'skipped',detail:'Training recording does not request a cloud browser'})}),
 preparePreview:async job=>job,
 stepJob:(input,options)=>stepScanJob(input,{...options,inspect:(target,options)=>inspectJobTarget(target,{...options,validate,urlLookup:lookup,transport})})
});
const app=express();app.use('/api/game-scam-guard',(req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});app.use(express.static('_site'));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const strings={
 en:{badge:'TRAINING FIXTURES · LOCAL BUILD · SIMULATED URL REPORTS',chapters:[
  ['Start with a public website','Paste a public website URL. GameScam Guard inspects received page evidence.'],
  ['Watch the scan','Progress and the result appear on the same screen.'],
  ['Read the coverage','One engine performs 20 distinct static checks. It does not execute website scripts.'],
  ['Inspect the whole redirect path','Threat sources shows observations for the initial, intermediate and final addresses.'],
  ['Choose the additional scope','Confirm linked-page inspection. The submitted-page assessment is preserved.'],
  ['Understand new threat evidence','This training destination has a simulated report. The expanded assessment explains the change.'],
  ['Run the built-in self-test','38 selected harmless fixtures test detection, benign controls and security boundaries.'],
  ['Recognize missing evidence','A simulated provider outage gives an incomplete result, not a claim of safety.'],
  ['Review the source settings','Know which sources are configured. A completed observation is not a safety guarantee.']
 ]},
 fa:{badge:'نمونهٔ آموزشی · نسخهٔ محلی · پاسخ ساختگی منابع نشانی',chapters:[
  ['با نشانی عمومی شروع کنید','لینک عمومی وب‌سایت را وارد کنید. برنامه شواهد محتوای دریافت‌شده را بررسی می‌کند.'],
  ['پیشرفت بررسی را ببینید','پیشرفت و نتیجه کنار همان فرم نمایش داده می‌شوند.'],
  ['پوشش را بخوانید','یک موتور بیست بررسی ایستا دارد و اسکریپت وب‌سایت را اجرا نمی‌کند.'],
  ['کل مسیر انتقال را بررسی کنید','منابع تهدید، پاسخ نشانی اول، میانی و نهایی را جداگانه نشان می‌دهد.'],
  ['دامنهٔ بررسی را انتخاب کنید','بررسی صفحه‌های مرتبط را تأیید کنید. ارزیابی صفحهٔ اولیه حفظ می‌شود.'],
  ['دلیل شاهد تازه را بخوانید','این مقصد آموزشی گزارش ساختگی دارد. ارزیابی گسترده‌تر دلیل تغییر را توضیح می‌دهد.'],
  ['خودآزمایی داخلی را اجرا کنید','سی‌وهشت نمونهٔ منتخب و بی‌خطر، تشخیص، کنترل بی‌خطر و مرزهای امنیتی را می‌سنجند.'],
  ['شواهد ناقص را تشخیص دهید','اختلال ساختگی منبع، نتیجهٔ ناقص می‌دهد و ادعای امنیت تولید نمی‌کند.'],
  ['وضعیت منابع را ببینید','منابع پیکربندی‌شده را بشناسید. مشاهدهٔ کامل به معنی تضمین امنیت نیست.']
 ]}
};
const metadata={scope:'real-local-ui-with-authored-html-and-simulated-threat-responses',audio:false,published:false,videos:[]};
let browser;
await mkdir(output,{recursive:true});await mkdir('/workspace/malguard-inspection',{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const locale of ['en','fa']){
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game-scam-guard/`);
  if(locale==='fa')await page.getByRole('button',{name:'Change language',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  await page.addStyleTag({content:'.g-app{padding-top:48px!important;padding-bottom:155px!important}#training-badge{position:fixed;top:0;inset-inline:0;z-index:9999;padding:6px 18px;text-align:center;background:#573b11;color:#ffe0a2;font:600 14px Vazirmatn,system-ui}#training-caption{position:fixed;bottom:0;inset-inline:0;z-index:9999;padding:17px 40px 20px;background:#081223f5;border-top:2px solid #5aacf1;text-align:center;font-family:Vazirmatn,system-ui;line-height:1.7;color:#eef6ff}#training-caption b{display:block;font-size:23px}#training-caption p{margin:4px 0 0;font-size:20px;color:#c6ddf5}'});
  await page.evaluate(badge=>{const top=document.createElement('div');top.id='training-badge';top.textContent=badge;document.body.append(top);const caption=document.createElement('div');caption.id='training-caption';caption.innerHTML='<b></b><p></p>';document.body.append(caption);},strings[locale].badge);
  const target=new URL(`training-${locale}.mp4`,output);
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','5','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',target.pathname],{stdio:['pipe','ignore','pipe']});
  let encoderError='';encoder.stderr.on('data',data=>encoderError+=data.toString());const encoderFinished=once(encoder,'close');
  let running=true,frames=0;const chapters=[];
  const capturing=(async()=>{while(running){const start=Date.now();const jpeg=await page.screenshot({type:'jpeg',quality:85,animations:'disabled'});if(!encoder.stdin.write(jpeg))await once(encoder.stdin,'drain');frames++;await pause(Math.max(1,200-(Date.now()-start)));}})();
  const scene=async(index,action)=>{
   const [title,body]=strings[locale].chapters[index];chapters.push({start:frames/5,title,body});
   await page.evaluate(({title,body})=>{document.querySelector('#training-caption b').textContent=title;document.querySelector('#training-caption p').textContent=body;},{title,body});
   await action?.();await pause(4000);
  };
  const details=async name=>{const root=page.locator('.g-report-details');if(await root.getAttribute('open')===null)await root.locator(':scope > summary').click();await root.getByRole('tab',{name,exact:true}).click();await root.scrollIntoViewIfNeeded();};
  try{
   await scene(0,()=>page.getByLabel(locale==='en'?'Website link':'لینک وب‌سایت').fill('https://example.com/training'));
   await scene(1,async()=>{await page.getByRole('button',{name:locale==='en'?'Start scan':'شروع بررسی',exact:true}).click();await page.locator('.verdict.limited').waitFor();});
   await scene(2,()=>details(locale==='en'?'Coverage':'پوشش'));assert.equal(await page.locator('.analysis-modules article').count(),20);
   await scene(3,()=>details(locale==='en'?'Threat sources':'منابع تهدید'));assert.equal(await page.locator('.g-url-sources').count(),3);
   await scene(4,async()=>{await page.getByRole('button',{name:locale==='en'?'Inspect linked pages':'بررسی صفحه‌های مرتبط',exact:true}).click();await page.getByRole('dialog').waitFor();});
   await scene(5,async()=>{await page.getByRole('button',{name:locale==='en'?'Scan public pages':'بررسی صفحه‌های عمومی',exact:true}).click();await page.locator('.verdict.danger').waitFor();await page.evaluate(()=>window.scrollTo(0,0));});
   await scene(6,async()=>{await page.getByRole('button',{name:locale==='en'?'Self-test':'خودآزمایی',exact:true}).click();await page.getByRole('button',{name:locale==='en'?'Run self-test':'اجرای خودآزمایی',exact:true}).click();await page.locator('.g-test-result.passed').waitFor();});
   await scene(7,async()=>{await page.getByRole('button',{name:locale==='en'?'Scan':'بررسی',exact:true}).click();await page.getByLabel(locale==='en'?'Website link':'لینک وب‌سایت').fill('https://example.com/provider-unavailable');await page.getByRole('button',{name:locale==='en'?'Start scan':'شروع بررسی',exact:true}).click();await page.locator('.verdict.unavailable').waitFor();});
   await scene(8,()=>page.getByRole('button',{name:locale==='en'?'Settings':'تنظیمات',exact:true}).click());
   assert.deepEqual(errors,[]);
  }finally{running=false;await capturing;encoder.stdin.end();const [code]=await encoderFinished;if(code!==0)throw new Error(encoderError||'Video encoding failed');await context.close();}
  const duration=frames/5;metadata.videos.push({locale,duration,frames,chapters});
  const stamp=seconds=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
  await writeFile(new URL(`training-${locale}.vtt`,output),'WEBVTT\n\n'+chapters.map((item,index)=>`${index+1}\n${stamp(item.start)} --> ${stamp(chapters[index+1]?.start??duration)}\n${item.title}\n${item.body}\n`).join('\n'));
  await copyFile(target,`/workspace/malguard-inspection/gamescam-training-${locale}.mp4`);
  const webm=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',target.pathname,'-an','-c:v','libvpx-vp9','-crf','35','-b:v','0','-cpu-used','4','-threads','2',new URL(`training-${locale}.webm`,output).pathname],{stdio:'ignore'});
  const [webmCode]=await once(webm,'close');assert.equal(webmCode,0,'Open-codec video fallback must encode');
  console.log(`PASS: ${locale} walkthrough encoded; ${duration.toFixed(1)} seconds, 9 chapters, real UI assertions passed.`);
 }
 await writeFile('/workspace/malguard-inspection/gamescam-training-metadata.json',JSON.stringify(metadata,null,2));
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
