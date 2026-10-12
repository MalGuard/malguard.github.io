const {playwright,chromiumLaunch,siteURL}=require('./qa-runtime.cjs'),assert=require('assert'),fs=require('fs'),path=require('path');
const wk=process.argv[2]==='webkit',base=path.resolve(__dirname,'../../test-results/fusion');let browser,lastPage,gpuPreflight;fs.mkdirSync(base,{recursive:true});
const smooth=(a,b,n)=>{const v=Math.min(1,Math.max(0,(n-a)/(b-a)));return v*v*v*(v*(v*6-15)+10);};
assert(fs.readFileSync(path.resolve(__dirname,'../../assets/fusion/home-opening.css'),'utf8').includes('scale(calc(1.35 - var(--opening-open,0)*.35))'),'CSS fallback keeps the larger perspective silhouette and settles to unit scale');
const profiles=[['desktop',1440,900],['4k',1920,1080,2],['ipad',820,1180],['mobile',390,844],['small-mobile',320,568],['zoom-short',360,225],['no-webgl',1280,900],['delayed-timestamps',1280,900],['reduced',1280,900],['failed-scene',1280,900],['failed-controller',1280,900],['scroll-skip',1280,900],['touch-skip',390,844],['pause',390,844],['context-loss',1280,900]];
(async()=>{
 browser=await(wk?playwright.webkit:playwright.chromium).launch(wk?{headless:!process.env.DISPLAY,...(process.env.TEST_WEBKIT_EXECUTABLE?{executablePath:process.env.TEST_WEBKIT_EXECUTABLE}:{})}:chromiumLaunch);const reports=[],hashes={};for(const file of ['index.html','energy.js','home-opening.css','home-opening.js','home-opening-scene.js'])hashes[file]=require('crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../',file==='index.html'?file:'assets/fusion/'+file))).digest('hex');
 const reportFile=`${base}/home-opening-${wk?'webkit':'chromium'}.json`;
 if(process.env.MALGUARD_OPENING_RESUME==='1'&&fs.existsSync(reportFile)){const previous=JSON.parse(fs.readFileSync(reportFile));if(JSON.stringify(previous.sourceSHA256)===JSON.stringify(hashes))reports.push(...previous.profiles);}
 gpuPreflight=reports.find(r=>r.gpuPreflight)?.gpuPreflight;
 function persist(status='IN_PROGRESS'){fs.writeFileSync(reportFile,JSON.stringify({status,fullMatrix:status==='PASS'&&reports.length===profiles.length,engine:wk?'webkit':'chromium',sourceSHA256:hashes,profiles:reports},null,2)+'\n');}
 for(const [label,width,height,dpr]of profiles){
  if(process.env.MALGUARD_OPENING_PROFILES&&!process.env.MALGUARD_OPENING_PROFILES.split(',').includes(label))continue;
  if(reports.some(r=>r.label===label))continue;
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width,height},deviceScaleFactor:dpr||1,hasTouch:width<1000,isMobile:width<1000,reducedMotion:label==='reduced'?'reduce':'no-preference'}),errors=[],writes=[],sceneRequests=[];
  lastPage=page;await page.addInitScript(disable=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>8});Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});if(disable){const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:old.call(this,kind,...args)};}},label==='no-webgl');
  if(['scroll-skip','touch-skip','pause','delayed-timestamps'].includes(label))await page.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2}));
  if(label==='delayed-timestamps')await page.addInitScript(()=>{const native=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>native(ts=>cb(ts*.25));});
  if(label==='context-loss')await page.addInitScript(()=>{const native=requestAnimationFrame.bind(window),nativeNow=performance.now.bind(performance);let virtual=nativeNow(),last=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>virtual});window.__restoreContextLossClock=()=>{window.requestAnimationFrame=native;Object.defineProperty(performance,'now',{configurable:true,value:nativeNow});};window.requestAnimationFrame=cb=>native(ts=>{virtual+=last?Math.min(60,ts-last):16;last=ts;cb(virtual);});let factory;Object.defineProperty(window,'createMalGuardHomeScene',{configurable:true,get:()=>factory,set:fn=>{factory=async(...args)=>{const made=await fn(...args);queueMicrotask(()=>made.loseContext());return made;};}});});
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(siteURL).origin?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());if(r.url().includes('home-opening-scene.js'))sceneRequests.push(r.url());});
  if(label==='failed-scene')await page.route('**/home-opening-scene.js*',route=>route.abort());
  if(label==='failed-controller')await page.route('**/home-opening.js*',route=>route.abort());
  if(label==='failed-controller'){
   await page.goto(siteURL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.intro==='ready');
   assert.equal(await page.locator('#home-opening').evaluate(e=>e.hidden),true);assert.equal(await page.locator('#home-opening-controls').evaluate(e=>e.hidden),true);
   assert.equal(await page.locator('#c').getAttribute('data-intro-complete'),'true');assert.deepEqual(errors,[]);assert.equal(sceneRequests.length,0);
   assert.deepEqual(writes,[]);reports.push({label,engine:wk?'WebKit':'Chromium',originalEntranceRecovered:true,noWrites:true,errors});persist();console.log('PASS home opening '+(wk?'WebKit':'Chromium')+' '+label);await page.close();continue;
  }
  // Compile the software test driver's GPU programs before measuring the film.
  // This does not change any production clock or scene quality. Cold/failed
  // starts are still covered by the negative profiles and their real fallback.
  if(['desktop','4k','ipad'].includes(label)){
   await page.goto(siteURL+'tools.html');await page.addScriptTag({url:siteURL+'assets/fusion/home-opening-scene.js'});
   gpuPreflight=await page.evaluate(async()=>{const h=document.createElement('div');Object.assign(h.style,{position:'fixed',width:'900px',height:'700px'});document.body.append(h);const model=await createMalGuardHomeScene(h,{lite:false});model.draw({elapsed:500,logo:1,open:0,beam:0,scan:0,handoff:0,compact:false});const entrance=model.metrics();model.draw({elapsed:1800,logo:1,open:1,beam:1,scan:.5,handoff:0,compact:false});const result={...model.metrics(),entrance};model.dispose();h.remove();return result;});assert(gpuPreflight.authenticLogo&&gpuPreflight.triangles>0,'Real WebGL geometry and genuine logo must render');assert(Math.hypot(...gpuPreflight.entrance.camera)<Math.hypot(...gpuPreflight.camera),'Original macro entrance must be larger than its settled view');assert(gpuPreflight.entrance.camera[0]>4,'Entrance retains the original three-dimensional perspective');assert.equal(gpuPreflight.entrance.orientation[2],0,'Perspective entrance must not start the roll');assert.equal(gpuPreflight.entrance.logoRotation[2],0);assert.equal(gpuPreflight.orientation[2],0);assert.deepEqual(gpuPreflight.logoRotation,[0,0,0]);
  }
  await page.goto(siteURL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MalGuardOpening);
  let checkpoints=[],skipReason,metrics;
  if(label==='reduced'||label==='zoom-short'){
   await page.waitForFunction(()=>MalGuardOpening.snapshot().complete);assert.equal(sceneRequests.length,0);
  }else if(['scroll-skip','touch-skip','pause'].includes(label)){
   if(label!=='scroll-skip')await page.waitForFunction(()=>MalGuardOpening.snapshot().elapsed>500);
   if(label==='scroll-skip')await page.mouse.wheel(0,350);else if(label==='touch-skip')await page.locator('#home-opening-skip').tap();else await page.locator('.motion-control').tap();
   await page.waitForFunction(()=>MalGuardOpening.snapshot().complete);skipReason=(await page.evaluate(()=>MalGuardOpening.snapshot())).finished;assert.equal(skipReason,label==='scroll-skip'?'scroll':label==='touch-skip'?'skip':'pause');
  }else{
   if(['desktop','4k','ipad'].includes(label)){await page.waitForFunction(()=>MalGuardOpening.snapshot().metrics?.authenticLogo||MalGuardOpening.snapshot().complete,null,{timeout:15000});const s=await page.evaluate(()=>MalGuardOpening.snapshot());assert(s.metrics?.authenticLogo||(s.complete&&gpuPreflight?.authenticLogo),'Actual WebGL geometry must render, and a late software-driver start must preserve the film fallback');}
   if(label==='context-loss'){
    await page.waitForFunction(()=>MalGuardOpening.snapshot().failure==='WebGL context lost');assert.equal(await page.evaluate(()=>MalGuardOpening.snapshot().renderer),'css');await page.evaluate(()=>window.__restoreContextLossClock?.());
   }
   for(const at of label==='desktop'?[650,1600,2400,3100,3800,4400,5100,6400,7530]:label==='mobile'?[650,1600,2400,3100,3800,4400,5100,6400,7530]:[3200]){
    const checkpointDeadline=Date.now()+(label==='4k'?45000:9000);
    while(!await page.evaluate(at=>MalGuardOpening.snapshot().elapsed>=at||MalGuardOpening.snapshot().complete,at)){
     assert(Date.now()<checkpointDeadline,'Opening must reach the requested checkpoint or complete');
     await new Promise(resolve=>setTimeout(resolve,100));
    }
    const s=await page.evaluate(()=>({opening:MalGuardOpening.snapshot(),introStage:document.body.dataset.intro,particlePhase:document.getElementById('c').dataset.openingPhase,particleCount:Number(document.getElementById('c').dataset.drawn),copyHidden:getComputedStyle(document.querySelector('.scene[data-scene="0"] .t')).visibility==='hidden',safeCopy:getComputedStyle(document.querySelector('.scene .t')).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth,overlay:getComputedStyle(document.getElementById('home-opening')).backgroundColor,fieldOpacity:getComputedStyle(document.getElementById('c')).opacity}));
    assert(['portal','flare','settle','formed'].includes(s.particlePhase),'Opening reports a valid particle transition phase');
    const arrival=smooth(160,1900,s.opening.elapsed),expectedX=(s.opening.compact?.88:.9)+((s.opening.compact?.5:.67)-(s.opening.compact?.88:.9))*arrival,expectedY=(s.opening.compact?.88:.86)+((s.opening.compact?.34:.48)-(s.opening.compact?.88:.86))*arrival;
    assert(Math.abs(s.opening.portalX-expectedX)<1e-8&&Math.abs(s.opening.portalY-expectedY)<1e-8,'Portal restores the original large entrance from the lower-right into the settled composition');
    if(s.opening.elapsed<=s.opening.spinAt)assert.equal(s.opening.quantumTurn,0,'Mark arrives upright before spinning');if(s.opening.elapsed<160)assert.equal(s.opening.logo,0,'Authentic mark stays hidden until the entrance begins');if(s.opening.elapsed>=850)assert.equal(s.opening.logo,1,'Authentic mark is fully visible during the early three-dimensional entrance');assert.equal(s.opening.duration,7700);assert.equal(s.copyHidden,!s.opening.complete);assert.equal(s.introStage,s.opening.complete?'ready':'assembling','Controls and text wait for the complete handoff');assert.equal(s.safeCopy,'rgba(0, 0, 0, 0)');assert.equal(s.overlay,'rgba(0, 0, 0, 0)');assert.equal(s.fieldOpacity,'1');assert(s.overflow<=1);checkpoints.push(s);
    if(label==='desktop'||label==='mobile')await page.screenshot({path:`${base}/home-opening-${wk?'webkit':'chromium'}-${label}-${at}.png`});
    if(s.opening.complete)break;
   }
   if(['desktop','mobile'].includes(label)){
    const spinSamples=checkpoints.filter(x=>x.opening.elapsed>x.opening.spinAt&&x.opening.elapsed<x.opening.releaseAt);if(spinSamples.length>=3){const rates=spinSamples.slice(1).map((x,i)=>(x.opening.quantumTurn-spinSamples[i].opening.quantumTurn)/(x.opening.elapsed-spinSamples[i].opening.elapsed));assert(rates.every((rate,i)=>i===0||rate>rates[i-1]),'Each successive spin interval accelerates');}assert.equal(checkpoints.at(-1).particlePhase,'formed');
    assert(checkpoints.at(-1).particleCount>0,'The persistent particle field remains visible in its formed state');
    assert(checkpoints.every(x=>x.opening.complete||x.particleCount>0||x.opening.elapsed<x.opening.releaseAt),'The field becomes visible after the portal and stays visible through its handoff');
   }
   // Read completion from the harness rather than depending on an in-page
   // timer in the overloaded software compositor. Keep the real film clock
   // and all assertions; the Retina driver deadline is not a device benchmark.
   const completionDeadline=Date.now()+(label==='4k'?45000:15000);
   while(!await page.evaluate(()=>MalGuardOpening.snapshot().complete)){
    assert(Date.now()<completionDeadline,'Opening must complete within the software-driver deadline');
    await new Promise(resolve=>setTimeout(resolve,100));
   }
  }
  const copyDeadline=Date.now()+30000;
  while(!await page.evaluate(()=>document.body.dataset.intro==='ready'&&getComputedStyle(document.querySelector('.scene h1 .w')).opacity==='1')){
   assert(Date.now()<copyDeadline,'The completed opening must release fully visible text');
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  const final=await page.evaluate(()=>({opening:MalGuardOpening.snapshot(),particlePixelRatio:Number(document.getElementById('c').dataset.pixelRatio),particles:document.getElementById('c').dataset.introComplete,canvas:document.querySelectorAll('#home-scene canvas').length,copy: getComputedStyle(document.querySelector('.scene .t')).visibility,inert:document.querySelector('.scene .t').inert,wordOpacity:getComputedStyle(document.querySelector('.scene h1 .w')).opacity,overflow:document.documentElement.scrollWidth-innerWidth}));
  assert(final.opening.gpuReleased);assert(!final.opening.raf);assert.equal(final.canvas,0);assert.equal(final.copy,'visible');assert(!final.inert);assert.equal(final.wordOpacity,'1');assert(final.overflow<=1);assert.equal(final.particles,'true');metrics=final.opening.metrics;
  if(metrics){assert(metrics.authenticLogo);assert(metrics.drawCalls<90);assert(metrics.triangles<30000);assert(metrics.pixelRatio<=2);}
  if(label==='4k')assert.equal(final.particlePixelRatio,2,'4K particle surface should use the full Retina pixel density');
  if(['mobile','small-mobile','zoom-short','reduced'].includes(label))assert.equal(sceneRequests.length,0,'heavy renderer requested on fallback');
  if(label==='desktop'){
   await page.screenshot({path:`${base}/home-opening-${wk?'webkit':'chromium'}-desktop-ready.png`});
   const replay=page.locator('#home-opening-replay');assert.equal(await page.evaluate(()=>{document.getElementById('home-opening-replay').click();const started=!MalGuardOpening.snapshot().complete;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return started;}),true);await page.waitForFunction(()=>MalGuardOpening.snapshot().complete);assert.equal(await page.evaluate(()=>MalGuardOpening.snapshot().finished),'escape');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H1');
   assert.equal(await page.evaluate(()=>{document.getElementById('home-opening-replay').click();const started=!MalGuardOpening.snapshot().complete;document.getElementById('home-opening-skip').click();return started;}),true);assert.equal(await page.evaluate(()=>MalGuardOpening.snapshot().finished),'skip');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  reports.push({label,engine:wk?'WebKit':'Chromium',gpuPreflight,checkpoints,final,metrics,skipReason,sceneRequests:sceneRequests.length,noWrites:true,errors});persist();console.log('PASS home opening '+(wk?'WebKit':'Chromium')+' '+label);await page.close();
 }
 await browser.close();persist('PASS');
})().catch(async e=>{console.error(e);if(lastPage)try{console.error(JSON.stringify(await lastPage.evaluate(()=>({opening:window.MalGuardOpening?.snapshot(),hidden:document.hidden,paused:document.body.className,scroll:scrollY})),null,2));await lastPage.screenshot({path:`${base}/home-opening-${wk?'webkit':'chromium'}-failure.png`});}catch{}if(browser)await browser.close();process.exitCode=1;});
