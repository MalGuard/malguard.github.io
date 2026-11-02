import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
import {engineDriveAt} from '../tools/product-engine-drive.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8085';
assert.equal(new URL(base).hostname,'127.0.0.1');
const browser=await chromium.launch(launchOptions('chromium'));
try{
 const page=await browser.newPage({viewport:{width:390,height:500}});
 await page.goto(base+'/?motion=engine',{waitUntil:'networkidle'});
 const model=page.locator('.engine3d-host');
 // Near-view preparation may preload code, but cannot construct a GPU scene.
 await model.evaluate(n=>window.scrollTo(0,scrollY+n.getBoundingClientRect().top-innerHeight-30));
 await page.waitForTimeout(250);assert.equal(await model.locator('canvas').count(),0);
 const inspect=()=>model.evaluate(n=>n.engine3D.inspect());
 await model.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('.engine3d-host')?.engine3D,{timeout:30000});
 let state=await inspect();assert.ok(state.time<.4);assert.equal(state.startupPhase,'off');assert.ok(state.effects.every(e=>!e.air&&!e.fuel&&!e.fire&&!e.spark&&!e.exhaust));
 await page.waitForFunction(()=>document.querySelector('.brand-orbit').dataset.motionStarted==='true');
 await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().time>0);state=await inspect();assert.ok(state.time>0&&state.time<1);assert.equal(state.paused,false);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().paused);const frozen=await inspect();const ringBefore=await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform);await page.waitForTimeout(250);assert.equal(await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform),ringBefore,'Offscreen ring freezes with the crank');assert.ok(frozen.paused);assert.equal((await inspect()).time,frozen.time);
 await model.scrollIntoViewIfNeeded();await page.waitForFunction(t=>document.querySelector('.engine3d-host').engine3D.inspect().time>t,frozen.time);
 // A visible cold start: injection and ignition happen with the crank still stationary.
 for(const [time,stage,effect] of [[0,'off',null],[.2,'off',null],[.7,'fuel','fuel'],[1.25,'ignition','spark'],[1.43,'combustion','fire'],[1.8,'running','fire']]){
  state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},time);
  assert.equal(state.startupPhase,stage);if(effect)assert.ok(state.effects[0][effect],effect+' is visible');
  if(time<1.35)assert.ok(state.effects.every(e=>!e.fire),'No combustion before injection and spark');
  if(time<1.52){assert.ok(Math.abs(state.crankAngle-state.restAngle)<1e-8,'Crank stays still until after combustion');assert.equal(await page.locator('.orbit-rotor').evaluate(n=>parseFloat(n.style.getPropertyValue('--engine-drive-angle'))),0);}
  if(time>=1.52)assert.ok(state.crankAngle>state.restAngle,'Combustion starts crank motion');
  assert.equal(state.valves[0].inlet,0);assert.equal(state.valves[0].outlet,0,'Initial combustion is sealed');
  assert.ok(state.rodErrors.every(v=>v<1e-5));
 }
 // Locate actual crank positions so valve checks do not depend on a fixed RPM.
 for(const [turn,phase,effect] of [[3.5,'exhaust','exhaust'],[4.4,'intake','fuel'],[5.3,'compression',null],[5.97,'compression','spark'],[6.12,'combustion','fire']]){
  const target=turn*Math.PI;let low=0,high=15;for(let i=0;i<24;i++){const mid=(low+high)/2;if(engineDriveAt(mid).angle<target)low=mid;else high=mid;}
  state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},(low+high)/2);
  assert.ok(Math.abs(state.crankAngle-target)<1e-4,'Rendered mechanism reaches the expected crank position');
  assert.equal(state.cyclePhase,phase);if(effect)assert.ok(state.effects[0][effect],effect+' is visible');
  const valve=state.valves[0];
  if(phase==='exhaust'){assert.ok(valve.outlet>.05);assert.equal(valve.inlet,0);}
  else if(phase==='intake'){assert.ok(valve.inlet>.05);assert.equal(valve.outlet,0);}
  else{assert.equal(valve.inlet,0);assert.equal(valve.outlet,0);}
  for(let i=0;i<2;i++){const lift=i?valve.outlet:valve.inlet;assert.equal(valve.stemY[i],-lift);assert.ok(Math.abs(valve.springScale[i]-(1-lift/.22))<1e-7,'Spring compresses as the valve opens into the chamber');}
 }
 // Shared rev envelope climbs to the maximum, then coasts down and repeats.
 let previous=0;
 for(const [time,trend] of [[2,'up'],[4,'up'],[6,'up'],[7.8,'peak'],[10,'down'],[13,'down'],[16.52,'stopped'],[19,'restart']]){
  const rev=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);const state=n.engine3D.inspect(),rotor=n.closest('.brand-orbit').querySelector('.orbit-rotor');return {...state,display:Number(n.closest('.brand-orbit').querySelector('.engine-speed-value').textContent),orbit:parseFloat(rotor.style.getPropertyValue('--engine-drive-angle'))};},time);
  assert.equal(rev.display,Math.round(rev.speed*100),'Readout follows the same rev clock');
  if(trend==='up'||trend==='restart')assert.ok(rev.speed>previous);
  if(trend==='down')assert.ok(rev.speed<previous);
  if(trend==='peak')assert.equal(rev.display,100);
  if(trend==='stopped')assert.equal(rev.display,0);
  assert.ok(Math.abs(rev.orbit-(rev.crankAngle-rev.restAngle)*180/Math.PI/8)<1e-5,'Revving preserves app gearing');
  previous=rev.speed;
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const time of [0,1.43,1.8,6.8]){
   const geometry=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);const rotor=n.closest('.brand-orbit').querySelector('.orbit-rotor'),tile=rotor.querySelector('.orbit-tile');return {rest:n.engine3D.inspect().restAngle,crank:n.engine3D.inspect().crankAngle,angle:parseFloat(rotor.style.getPropertyValue('--engine-drive-angle')),rotor:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(rotor).transform)[k])],tile:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(tile).transform)[k])],animation:getComputedStyle(rotor).animationName};},time);
   assert.equal(geometry.animation,'none','Engine ring has no independent animation');assert.ok(Math.abs(geometry.angle-(geometry.crank-geometry.rest)*180/Math.PI/8)<1e-5);
   const angle=(geometry.crank-geometry.rest)/8;assert.ok(Math.abs(geometry.rotor[0]-Math.cos(angle))<1e-5);assert.ok(Math.abs(geometry.rotor[1]-Math.sin(angle))<1e-5);
   assert.ok(Math.abs(geometry.tile[1]+Math.sin(angle))<1e-5,'App face counter-rotates to stay upright');
  }
 }
 for(const [name,time] of [['off',0],['injection',.7],['spark',1.25],['pressure',1.43],['power',1.8]]){await model.evaluate((n,t)=>n.engine3D.renderAt(t),time);await page.locator('.orbit-stage').screenshot({path:`test-results/cold-start-${name}.png`});}
 console.log('PASS earlier cold start and rising and falling engine/app revs with a synchronized numeric readout');
 console.log('PASS cold start, injection before spark, combustion before motion, valve direction and crank-driven app ring, 8:1 gearing, upright faces on mobile and desktop, shared offscreen pause');
 await page.screenshot({path:'test-results/combustion-mobile.png'});
 console.log('PASS viewport start, prewarm without playback, offscreen freeze, resume and four-stroke combustion sequence');
}finally{await browser.close();}
