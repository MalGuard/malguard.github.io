// Fixed film checkpoints keep software GPU compilation and screenshots from
// skipping the burst. The state comes from the actual production controller.
const {playwright,chromiumLaunch,siteURL}=require('./qa-runtime.cjs');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/fusion/home-opening.js'),'utf8');
const stateSource=source.slice(source.indexOf('  function state(){'),source.indexOf('  function releaseRenderer'));
const context=vm.createContext({innerWidth:1440,Math,elapsed:0,duration:7700,complete:false,frameDelta:16,spinAt:3400,releaseAt:5400,gatherAt:6150,formedAt:7450});
vm.runInContext('const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));const smooth=(a,b,n)=>{const v=clamp((n-a)/(b-a));return v*v*v*(v*(v*6-15)+10);};'+stateSource,context);
const state=t=>{context.elapsed=t;return JSON.parse(JSON.stringify(vm.runInContext('state()',context)));};
const webkit=process.argv[2]==='webkit',out=path.resolve(__dirname,'../../test-results/fusion');
fs.mkdirSync(out,{recursive:true});let browser;
(async()=>{
 browser=await(webkit?playwright.webkit:playwright.chromium).launch(webkit?{headless:!process.env.DISPLAY}:chromiumLaunch);
 const reports=[];
 for(const [name,width,height]of [['webgl',1440,900],['projection',390,844]]){
  context.innerWidth=width;
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(siteURL).origin?r.continue():r.abort());
  await page.goto(siteURL+'tools.html');await page.addStyleTag({url:siteURL+'assets/fusion/home-opening.css'});
  await page.addScriptTag({url:siteURL+`assets/fusion/home-opening-${name==='webgl'?'scene':'projection'}.js`});
  await page.evaluate(async name=>{
   document.body.innerHTML='<div id="home-opening"><div id="home-scene"></div></div>';document.body.style.background='#05070d';
   const root=document.getElementById('home-opening');root.style.zIndex='100';
   window.__explosionModel=name==='webgl'?await createMalGuardHomeScene(document.getElementById('home-scene'),{lite:false}):createMalGuardHomeProjection(root,{lite:true});
   window.__drawExplosion=s=>{
    root.style.setProperty('--opening-x',s.portalX*100+'%');root.style.setProperty('--opening-y',s.portalY*100+'%');
    root.style.setProperty('--opening-alpha',1-s.handoff);root.style.setProperty('--opening-core',s.coreEnergy);root.style.setProperty('--opening-burst',s.burst);root.style.setProperty('--opening-burst-scale',s.burstScale);
    __explosionModel.draw(s);return __explosionModel.metrics();
   };
  },name);
  const checks=[];
  for(const at of [650,3400,5200,5420,5610,5890]){
   const s=state(at);await page.waitForTimeout(35);const m=await page.evaluate(s=>__drawExplosion(s),s);
   assert(m.authenticLogo);assert(Math.abs(m.fragmentArea-m.sourceArea)<1e-8);
   assert.equal(m.fragmentsVisible,at>5370);if(at===5200)assert(m.coreIntensity>10);
   if(at>5400){assert(m.orientation[2]>checks.at(-1).metrics.orientation[2]);assert.notDeepEqual(m.fragmentPosition,checks.at(-1).metrics.fragmentPosition);}
   checks.push({at,state:s,metrics:m});
   await page.screenshot({path:path.join(out,`explosion-${webkit?'webkit':'chromium'}-${name}-${at}.png`)});
  }
  await page.evaluate(()=>__explosionModel.dispose());assert.deepEqual(errors,[]);await page.close();
  reports.push({name,width,height,checks,errors});console.log(`PASS fixed explosion ${webkit?'WebKit':'Chromium'} ${name}`);
 }
 fs.writeFileSync(path.join(out,`explosion-${webkit?'webkit':'chromium'}.json`),JSON.stringify({status:'PASS',reports},null,2)+'\n');
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
