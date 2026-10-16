/* Real scroll/reverse, glyph dissolution, reading safety and fallback verification.
   Only loopback fixtures are permitted; every external request is blocked. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {playwright,chromiumLaunch}=require('./fusion/qa-runtime.cjs');
const base=process.env.MALGUARD_PARTICLE_QA_URL||'https://127.0.0.1:8443';
assert.equal(new URL(base).hostname,'127.0.0.1');
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
const profiles=[['desktop',1440,900,1],['4k',1920,1080,2],['ipad',820,1180,2],['mobile',390,844,2],['small',320,568,1],['landscape',844,390,1]];
const reports=[];fs.mkdirSync('test-results/particle-story',{recursive:true});
async function seek(page,index,progress){await page.evaluate(({index,progress})=>{const r=MalGuardParticleStory.records[index];scrollTo({top:r.start+r.height*progress,behavior:'instant'});},{index,progress});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>Math.abs(MalGuardParticleStory.snapshot().scroll-scrollY)<1,null,{timeout:12000});}
async function snapshot(page,index){return page.evaluate(index=>{const r=MalGuardParticleStory.records[index],box=r.copy.getBoundingClientRect(),canvas=document.getElementById('c');return{...MalGuardParticleStory.snapshot().chapters[index],copy:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},wordOpacity:Math.min(...r.words.map(w=>Number(getComputedStyle(w).opacity))),cloud:canvas.dataset.cloudBounds.split(',').map(Number),target:Number(canvas.dataset.target),scene:Number(canvas.dataset.scene),glyphs:Number(canvas.dataset.glyphParticles),travel:Number(canvas.dataset.cameraTravel),overflow:document.documentElement.scrollWidth-innerWidth,canvasCount:document.querySelectorAll('#c').length,background:getComputedStyle(r.copy).backgroundColor,frameMs:Number(canvas.dataset.frameMs),readingHits:Number(canvas.dataset.readingHits),drawn:Number(canvas.dataset.drawn),backend:canvas.dataset.backend};},index);}
(async()=>{
for(const engine of engines){const browser=await playwright[engine].launch(engine==='webkit'?{headless:!process.env.DISPLAY}:chromiumLaunch);try{
 for(const [label,width,height,dpr]of profiles.filter(p=>!process.env.PARTICLE_PROFILES||process.env.PARTICLE_PROFILES.split(',').includes(p[0]))){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height},deviceScaleFactor:dpr,hasTouch:width<=900}),page=await context.newPage(),errors=[],external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===new URL(base).origin)return route.continue();external.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(memory=>{Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>memory});Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,get:()=>8});},label==='4k'?8:4);
  await page.addInitScript(()=>{sessionStorage.setItem('mg-home-intro-seen-v1','1');window.__prematureCopy=false;function check(){const copy=document.querySelector('.scene .t'),canvas=document.getElementById('c'),word=copy?.querySelector('.w');if(word&&getComputedStyle(copy).visibility==='visible'&&Number(getComputedStyle(word).opacity)>.05&&canvas?.dataset.introComplete!=='true')window.__prematureCopy=true;if(document.readyState!=='complete'||!window.MalGuardParticleStory||MalGuardParticleStory.snapshot().age<1400)requestAnimationFrame(check);}requestAnimationFrame(check);});
  await page.goto(base);await page.waitForFunction(()=>window.MalGuardParticleStory?.snapshot().age>=1400);assert.equal(await page.evaluate(()=>__prematureCopy),false,'Text flashed before the field formed');
  if(label==='4k')assert.deepEqual(await page.locator('#c').evaluate(c=>[c.width,c.height]),[3840,2160],'Capable retina desktop must render native 4K pixels');
  const holds=[];
  for(let index=0;index<5;index++){
   await seek(page,index,.2);await page.waitForFunction(index=>Number(document.querySelector(`[data-scene="${index}"]`).dataset.copyProgress)>.99,index);
   const s=await snapshot(page,index);assert.equal(s.phase,'hold');assert.equal(s.wordOpacity,1);assert.equal(s.target,index);assert(Math.abs(s.scene-index)<.002);assert(s.overflow<=1);assert.equal(s.background,'rgba(0, 0, 0, 0)');assert.equal(s.canvasCount,1);
   if(width>900){assert(s.readingHits/Math.max(1,s.drawn)<.02,'Bright geometry enters the reading volume: '+JSON.stringify(s));if(index!==0)assert(s.cloud[0]>=s.copy.right+6||s.cloud[1]>=s.copy.bottom+6,'Volumetric field crosses desktop reading copy: '+JSON.stringify(s));}
   else assert(s.cloud[3]<=s.copy.top-6||s.cloud[0]>=s.copy.right+6||s.cloud[2]<=s.copy.left-6,'Particle mass overlaps touch reading copy: '+JSON.stringify(s));
   holds.push(s);if(index===0)await page.screenshot({path:`test-results/particle-story/${engine}-${label}-hold.png`});
  }
  await seek(page,0,.65);const dissolve=await snapshot(page,0);assert.equal(dissolve.phase,'dissolve');assert(dissolve.wordOpacity<.1);assert(dissolve.glyphs>0,'Heading glyphs must become visible particles');assert(dissolve.travel>.1);await page.screenshot({path:`test-results/particle-story/${engine}-${label}-dissolve.png`});
  await seek(page,0,.86);assert((await snapshot(page,0)).opacity<.01,'A particle-only passage must separate readable chapters');
  await seek(page,1,.2);assert((await snapshot(page,1)).wordOpacity>.99);await seek(page,0,.2);assert((await snapshot(page,0)).wordOpacity>.99,'Reverse scroll must reform the earlier text');
  const action=page.locator('.scene[data-scene="0"] .cta a').first();await action.focus();assert(await action.evaluate(el=>el===document.activeElement),'The visible action must remain keyboard accessible');
  const language=page.locator('.mg-language select').first(),beforeLocale=await page.evaluate(()=>MalGuardParticleStory.snapshot().epoch);await language.selectOption('fa');await page.waitForFunction(epoch=>document.documentElement.dir==='rtl'&&MalGuardParticleStory.snapshot().epoch>epoch,beforeLocale);assert((await snapshot(page,0)).overflow<=1);assert((await snapshot(page,0)).points>0);await language.selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');await page.waitForTimeout(200);
  await page.locator('.motion-control').click();await page.waitForFunction(()=>document.body.classList.contains('motion-paused')&&MalGuardParticleStory.snapshot().chapters.every(c=>c.opacity===1));await page.waitForTimeout(200);const frozen=await page.locator('#c').evaluate(c=>c.toDataURL());await page.waitForTimeout(160);assert.equal(await page.locator('#c').evaluate(c=>c.toDataURL()),frozen,'Pause must stop the persistent field');await page.locator('.motion-control').click();
  await seek(page,5,.2);await page.waitForFunction(()=>document.getElementById('c').dataset.logoReady==='true'&&Number(document.getElementById('c').dataset.scene)>12.99);assert((await snapshot(page,5)).wordOpacity>.99);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>MalGuardParticleStory.snapshot().chapters.every(c=>c.opacity===1));assert((await snapshot(page,0)).wordOpacity===1);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);reports.push({engine,label,status:'PASS',holds,dissolve,reverse:true,reducedMotion:true,pauseResume:true,keyboard:true,initialTextHidden:true,errors});await context.close();console.log(`PASS particle story ${engine} ${label}`);
 }
 if(!process.env.PARTICLE_PROFILES)for(const failed of ['energy.js','particle-story.js']){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());await context.route(`**/${failed}*`,route=>route.abort());await page.goto(base);await page.waitForFunction(()=>document.body.dataset.intro==='ready'&&getComputedStyle(document.querySelector('.scene .t')).visibility==='visible'&&getComputedStyle(document.querySelector('.scene h1 .w')).opacity==='1',null,{timeout:25000});assert.deepEqual(errors,[]);reports.push({engine,label:'failed-'+failed,status:'PASS',contentRecovered:true,errors});await context.close();console.log(`PASS particle story ${engine} failed ${failed}`);
 }
 for(const mode of ['context-loss','missing-renderer','no-webgl']){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  await page.addInitScript(mode=>{sessionStorage.setItem('mg-home-intro-seen-v1','1');if(mode==='no-webgl'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...rest){return /webgl/.test(k)?null:original.call(this,k,...rest);};}},mode);
  if(mode==='missing-renderer')await context.route('**/field-renderer.js*',route=>route.abort());await page.goto(base);await page.waitForFunction(()=>window.MalGuardParticleStory?.snapshot().age>=1400);
  if(mode==='context-loss'){assert.equal(await page.locator('#c').getAttribute('data-backend'),'webgl');await page.evaluate(()=>MalGuardParticles.loseContext());}
  await page.waitForFunction(()=>document.querySelector('#c').dataset.backend==='canvas'&&Number(document.querySelector('#c').dataset.drawn)>100);
  await seek(page,1,.2);assert((await snapshot(page,1)).wordOpacity>.99);await page.locator('.motion-control').click();await page.waitForFunction(()=>MalGuardParticleStory.snapshot().chapters.every(c=>c.opacity===1));assert.equal(await page.locator('#c').count(),1);assert.deepEqual(errors,[]);
  reports.push({engine,label:mode,status:'PASS',contentRecovered:true,errors});await context.close();console.log(`PASS volume fallback ${engine} ${mode}`);
 }
}finally{await browser.close();}}
fs.writeFileSync('test-results/particle-story/report.json',JSON.stringify({status:'PASS',profiles:reports},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
