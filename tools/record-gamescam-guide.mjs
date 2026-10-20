// Record the real UI. All pages, URL reports and credentials below are inert
// training fixtures. No production email, threat lookup or browser VM is used.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {spawn,spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
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
// Narration is an explicit input. A visual preview never overwrites public films.
const preview=process.argv.includes('--visual-preview');
const outputPath=resolve(process.env.GSG_TRAINING_OUTPUT||'test-results/narrated-training');
assert.notEqual(outputPath,resolve(fileURLToPath(output)),'Record outside public/learn, review the files, then copy the complete bilingual set.');
const narration=JSON.parse(await readFile(new URL('./gamescam-narration.json',import.meta.url),'utf8'));
const manifestPath=process.env.GSG_NARRATION_MANIFEST;
assert.ok(preview||manifestPath,'Set GSG_NARRATION_MANIFEST to the reviewed bilingual audio manifest, or use --visual-preview.');
const manifest=manifestPath?JSON.parse(await readFile(manifestPath,'utf8')):null;
const run=async args=>{const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>error+=chunk);const [code]=await once(child,'close');assert.equal(code,0,error||'FFmpeg failed');};
const audioInputs={};
if(!preview)for(const locale of ['en','fa']){
 const input=manifest[locale];assert.equal(input?.language,locale);assert.equal(input?.transcript,narration[locale].chapters.join('\n\n'),'Narration must match the reviewed script');
 assert.equal(input.chapters?.length,9);const file=resolve(dirname(resolve(manifestPath)),input.file);await access(file);
 let previous=0;for(const [index,chapter] of input.chapters.entries()){
  assert.ok(Number.isFinite(chapter.start)&&Number.isFinite(chapter.end)&&chapter.end>chapter.start);
  assert.ok(Math.abs(chapter.start-previous)<0.03,'Audio chapters must cover the complete narration without gaps');
  if(index===0)assert.equal(chapter.start,0);previous=chapter.end;
 }
 const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'});assert.equal(probe.status,0);const info=JSON.parse(probe.stdout);
 assert.ok(info.streams.some(stream=>stream.codec_type==='audio'));assert.ok(Math.abs(Number(info.format.duration)-previous)<0.2,'Audio timing must cover the complete clip');
 audioInputs[locale]={...input,file};
}
const metadata={version:2,scope:'real-local-ui-with-authored-html-and-simulated-threat-responses',audio:!preview,preview,syntheticTestOnly:Boolean(manifest?.syntheticTestOnly),published:false,frameRate:25,cursor:'visible arrow with eased motion and click rings',videos:[]};
let browser;
await mkdir(outputPath,{recursive:true});
try{
 browser=await chromium.launch({...(process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 for(const locale of ['en','fa']){
  const recordingStart=Date.now();
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'no-preference',recordVideo:{dir:resolve(outputPath,'raw'),size:{width:1280,height:1000}}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/game-scam-guard/`);
  if(locale==='fa')await page.getByRole('button',{name:'Change language',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),locale);await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:`html{scroll-behavior:smooth}*{cursor:none!important}.g-app{padding-top:48px!important;padding-bottom:170px!important}#training-badge{position:fixed;top:0;inset-inline:0;z-index:2147483645;padding:6px 18px;text-align:center;background:#573b11;color:#ffe0a2;font:600 14px Vazirmatn,system-ui;pointer-events:none}#training-caption{position:fixed;bottom:0;inset-inline:0;z-index:2147483645;padding:14px 38px 18px;background:#081223f5;border-top:2px solid #5aacf1;text-align:center;font-family:Vazirmatn,system-ui;line-height:1.7;color:#eef6ff;pointer-events:none}#training-caption b{display:block;font-size:23px}#training-caption p{margin:3px 0 0;font-size:20px;color:#c6ddf5}#training-pointer{position:fixed;top:0;left:0;width:37px;height:46px;transform:translate(80px,140px);z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px #000)}.training-ring{position:fixed;width:26px;height:26px;border:3px solid #64dfff;background:#64dfff55;border-radius:50%;z-index:2147483646;pointer-events:none}`});
  const badge=strings[locale].badge+(preview?(locale==='en'?' · VISUAL PREVIEW · NARRATION PENDING':' · پیش‌نمایش تصویر · صدا در انتظار تولید'):'');
  await page.evaluate(badge=>{
   const top=document.createElement('div');top.id='training-badge';top.textContent=badge;document.body.append(top);
   const caption=document.createElement('div');caption.id='training-caption';caption.innerHTML='<b></b><p></p>';document.body.append(caption);
   const cursor=document.createElement('div');cursor.id='training-pointer';cursor.innerHTML='<svg viewBox="0 0 37 46"><path d="M3 2 L4 34 L13 26 L21 42 L28 38 L20 23 L32 22 Z" fill="#fff" stroke="#07182b" stroke-width="2.5" stroke-linejoin="round"/></svg>';document.body.append(cursor);
  },badge);
  let cursor={x:80,y:140};const movements=[];const chapters=[];
  const click=async(locator,activate=true)=>{
   await locator.evaluate(el=>el.scrollIntoView({behavior:'smooth',block:'nearest'}));await pause(650);
   let box=await locator.boundingBox();assert.ok(box,'Pointer target must be visible');
   if(box.y+box.height>800){await page.evaluate(delta=>window.scrollBy({top:delta,behavior:'smooth'}),box.y+box.height-760);await pause(650);box=await locator.boundingBox();}
   const next={x:box.x+box.width/2,y:box.y+box.height/2};assert.ok(next.y>35&&next.y<835,'A caption must not hide the pointer target');
   await page.evaluate(async({from,to})=>{const pointer=document.querySelector('#training-pointer');const animation=pointer.animate([{transform:`translate(${from.x}px,${from.y}px)`},{transform:`translate(${to.x}px,${to.y}px)`}],{duration:850,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});await animation.finished;pointer.style.transform=`translate(${to.x}px,${to.y}px)`;animation.cancel();},{from:cursor,to:next});
   cursor=next;await page.mouse.move(next.x,next.y);await pause(180);
   if(!activate){movements.push({time:(Date.now()-recordingStart)/1000,action:'point',...next});await pause(450);return;}
   await page.evaluate(({x,y})=>{const ring=document.createElement('div');ring.className='training-ring';ring.style.left=`${x-13}px`;ring.style.top=`${y-13}px`;document.body.append(ring);ring.animate([{transform:'scale(.6)',opacity:1},{transform:'scale(2.5)',opacity:0}],{duration:650,easing:'ease-out'}).finished.then(()=>ring.remove());},next);
   await page.mouse.click(next.x,next.y);movements.push({time:(Date.now()-recordingStart)/1000,action:'click',...next});await pause(300);
  };
  const type=async value=>{const input=page.getByLabel(locale==='en'?'Website link':'لینک وب‌سایت');await click(input);await input.fill('');await input.pressSequentially(value,{delay:35});};
  const scene=async(index,action)=>{
   const [title,body]=strings[locale].chapters[index];const start=(Date.now()-recordingStart)/1000;
   await page.evaluate(({title,body})=>{document.querySelector('#training-caption b').textContent=title;document.querySelector('#training-caption p').textContent=body;},{title,body});
   const spoken=audioInputs[locale]?.chapters[index];const length=spoken?spoken.end-spoken.start+1.0:[10,8,10,9,9,13,11,13,10][index];
   await action?.();await pause(Math.max(650,(start+length)*1000-(Date.now()-recordingStart)));
   chapters.push({start,end:(Date.now()-recordingStart)/1000,title,body,narration:narration[locale].chapters[index]});
   console.log(`${locale}: recorded chapter ${index+1}/9`);
  };
  const details=async name=>{const root=page.locator('.g-report-details');if(await root.getAttribute('open')===null)await click(root.locator(':scope > summary'));await click(root.getByRole('tab',{name,exact:true}));await root.evaluate(el=>el.scrollIntoView({behavior:'smooth',block:'center'}));await pause(700);};
  const video=page.video();
  try{
   await scene(0,()=>type('https://example.com/training'));
   await scene(1,async()=>{await click(page.getByRole('button',{name:locale==='en'?'Start scan':'شروع بررسی',exact:true}));await page.locator('.verdict.limited').waitFor();});
   await scene(2,()=>details(locale==='en'?'Coverage':'پوشش'));assert.equal(await page.locator('.analysis-modules article').count(),20);
   await scene(3,async()=>{await details(locale==='en'?'Threat sources':'منابع تهدید');const rows=page.locator('.g-url-sources');assert.equal(await rows.count(),3);for(const row of await rows.all())await click(row.locator('p'),false);});
   await scene(4,async()=>{await click(page.getByRole('button',{name:locale==='en'?'Inspect linked pages':'بررسی صفحه‌های مرتبط',exact:true}));await page.getByRole('dialog').waitFor();});
   await scene(5,async()=>{await click(page.getByRole('button',{name:locale==='en'?'Scan public pages':'بررسی صفحه‌های عمومی',exact:true}));await page.locator('.verdict.danger').waitFor();await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await pause(650);});
   await scene(6,async()=>{await click(page.getByRole('button',{name:locale==='en'?'Self-test':'خودآزمایی',exact:true}));await click(page.getByRole('button',{name:locale==='en'?'Run self-test':'اجرای خودآزمایی',exact:true}));await page.locator('.g-test-result.passed').waitFor();});
   await scene(7,async()=>{await click(page.getByRole('button',{name:locale==='en'?'Scan':'بررسی',exact:true}));await type('https://example.com/provider-unavailable');await click(page.getByRole('button',{name:locale==='en'?'Start scan':'شروع بررسی',exact:true}));await page.locator('.verdict.unavailable').waitFor();});
   await scene(8,()=>click(page.getByRole('button',{name:locale==='en'?'Settings':'تنظیمات',exact:true})));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const source=await video.path(),target=resolve(outputPath,`training-${locale}.mp4`),offset=chapters[0].start,duration=chapters.at(-1).end-offset;
  let audioFile;
  if(!preview){
   audioFile=resolve(outputPath,`narration-${locale}.wav`);const filters=[];
   for(const [i,chapter] of chapters.entries()){
    const audio=audioInputs[locale].chapters[i],length=chapter.end-chapter.start;
    filters.push(`[0:a]atrim=start=${audio.start}:end=${audio.end},asetpts=PTS-STARTPTS,adelay=400:all=1,apad,atrim=duration=${length}[a${i}]`);
   }
   filters.push(chapters.map((_,i)=>`[a${i}]`).join('')+'concat=n=9:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]');
   await run(['-i',audioInputs[locale].file,'-filter_complex',filters.join(';'),'-map','[out]','-ar','48000','-c:a','pcm_s16le',audioFile]);
  }
  await run(['-ss',String(offset),'-i',source,...(audioFile?['-i',audioFile]:[]),'-t',String(duration),'-map','0:v:0',...(audioFile?['-map','1:a:0','-c:a','aac','-b:a','128k']:['-an']),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-r','25','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  await run(['-i',target,'-c:v','libvpx-vp9','-crf','34','-b:v','0','-cpu-used','6','-row-mt','1','-threads','2',...(audioFile?['-c:a','libopus','-b:a','96k']:['-an']),resolve(outputPath,`training-${locale}.webm`)]);
  const stamp=seconds=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
  await writeFile(resolve(outputPath,`training-${locale}.vtt`),'WEBVTT\n\n'+chapters.map((item,index)=>`${index+1}\n${stamp(item.start-offset)} --> ${stamp(item.end-offset)}\n${preview?item.title+'\n'+item.body:item.narration}\n`).join('\n'));
  metadata.videos.push({locale,duration,chapters:chapters.map(item=>({...item,start:item.start-offset,end:item.end-offset})),movements:movements.map(item=>({...item,time:item.time-offset}))});
  await writeFile(resolve(outputPath,'training-manifest.json'),JSON.stringify(metadata,null,2));
  console.log(`PASS: ${locale} ${preview?'VISUAL PREVIEW (no narration)':'narrated walkthrough'}; ${duration.toFixed(1)} s, 25 fps, ${movements.length} pointer targets, 9 asserted UI chapters.`);
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
