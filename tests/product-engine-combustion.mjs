import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8085';
assert.equal(new URL(base).hostname,'127.0.0.1');
const browser=await chromium.launch(launchOptions('chromium'));
try{
 const page=await browser.newPage({viewport:{width:390,height:500}});
 await page.goto(base+'/?motion=engine',{waitUntil:'networkidle'});
 const model=page.locator('.engine3d-host');
 // Warm the module just outside the viewport; preparing shaders must not start its clock.
 await model.evaluate(n=>window.scrollTo(0,scrollY+n.getBoundingClientRect().top-innerHeight-30));
 await page.waitForFunction(()=>document.querySelector('.engine3d-host')?.engine3D,{timeout:30000});
 const inspect=()=>model.evaluate(n=>n.engine3D.inspect());
 await page.waitForTimeout(250);let state=await inspect();assert.equal(state.time,0);assert.ok(state.paused);assert.equal(state.startupPhase,'off');assert.ok(state.effects.every(e=>!e.air&&!e.fuel&&!e.fire&&!e.spark&&!e.exhaust));
 await model.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.brand-orbit').dataset.motionStarted==='true');
 await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().time>0);state=await inspect();assert.ok(state.time>0&&state.time<1);assert.equal(state.paused,false);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().paused);const frozen=await inspect();const ringBefore=await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform);await page.waitForTimeout(250);assert.equal(await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform),ringBefore,'Offscreen ring freezes with the crank');assert.ok(frozen.paused);assert.equal((await inspect()).time,frozen.time);
 await model.scrollIntoViewIfNeeded();await page.waitForFunction(t=>document.querySelector('.engine3d-host').engine3D.inspect().time>t,frozen.time);
 // A visible cold start: injection and ignition happen with the crank still stationary.
 for(const [time,stage,effect] of [[0,'off',null],[.6,'off',null],[1.1,'fuel','fuel'],[1.85,'ignition','spark'],[2.02,'combustion','fire'],[2.65,'running','fire']]){
  state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},time);
  assert.equal(state.startupPhase,stage);if(effect)assert.ok(state.effects[0][effect],effect+' is visible');
  if(time<1.94)assert.ok(state.effects.every(e=>!e.fire),'No combustion before injection and spark');
  if(time<2.12){assert.ok(Math.abs(state.crankAngle-state.restAngle)<1e-8,'Crank stays still until after combustion');assert.equal(await page.locator('.orbit-rotor').evaluate(n=>parseFloat(n.style.getPropertyValue('--engine-drive-angle'))),0);}
  if(time>=2.12)assert.ok(state.crankAngle>state.restAngle,'Combustion starts crank motion');
  assert.equal(state.valves[0].inlet,0);assert.equal(state.valves[0].outlet,0,'Initial combustion is sealed');
  assert.ok(state.rodErrors.every(v=>v<1e-5));
 }
 for(const [time,phase,effect] of [[5.15,'exhaust','exhaust'],[6.65,'intake','fuel'],[8.5,'compression',null],[9.35,'compression','spark'],[9.6,'combustion','fire']]){
  state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},time);
  assert.equal(state.cyclePhase,phase);if(effect)assert.ok(state.effects[0][effect],effect+' is visible');
  const valve=state.valves[0];
  if(phase==='exhaust'){assert.ok(valve.outlet>.05);assert.equal(valve.inlet,0);}
  else if(phase==='intake'){assert.ok(valve.inlet>.05);assert.equal(valve.outlet,0);}
  else{assert.equal(valve.inlet,0);assert.equal(valve.outlet,0);}
  for(let i=0;i<2;i++){const lift=i?valve.outlet:valve.inlet;assert.equal(valve.stemY[i],-lift);assert.ok(Math.abs(valve.springScale[i]-(1-lift/.22))<1e-7,'Spring compresses as the valve opens into the chamber');}
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const time of [0,2.02,2.65,6.8]){
   const geometry=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);const rotor=n.closest('.brand-orbit').querySelector('.orbit-rotor'),tile=rotor.querySelector('.orbit-tile');return {rest:n.engine3D.inspect().restAngle,crank:n.engine3D.inspect().crankAngle,angle:parseFloat(rotor.style.getPropertyValue('--engine-drive-angle')),rotor:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(rotor).transform)[k])],tile:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(tile).transform)[k])],animation:getComputedStyle(rotor).animationName};},time);
   assert.equal(geometry.animation,'none','Engine ring has no independent animation');assert.ok(Math.abs(geometry.angle-(geometry.crank-geometry.rest)*180/Math.PI/8)<1e-5);
   const angle=(geometry.crank-geometry.rest)/8;assert.ok(Math.abs(geometry.rotor[0]-Math.cos(angle))<1e-5);assert.ok(Math.abs(geometry.rotor[1]-Math.sin(angle))<1e-5);
   assert.ok(Math.abs(geometry.tile[1]+Math.sin(angle))<1e-5,'App face counter-rotates to stay upright');
  }
 }
 for(const [name,time] of [['off',0],['injection',1.1],['spark',1.85],['pressure',2.02],['power',2.65]]){await model.evaluate((n,t)=>n.engine3D.renderAt(t),time);await page.locator('.orbit-stage').screenshot({path:`test-results/cold-start-${name}.png`});}
 console.log('PASS cold start, injection before spark, combustion before motion, valve direction and crank-driven app ring, 8:1 gearing, upright faces on mobile and desktop, shared offscreen pause');
 await page.screenshot({path:'test-results/combustion-mobile.png'});
 console.log('PASS viewport start, prewarm without playback, offscreen freeze, resume and four-stroke combustion sequence');
}finally{await browser.close();}
