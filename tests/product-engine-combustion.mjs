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
 await page.waitForTimeout(250);let state=await inspect();assert.equal(state.time,0);assert.ok(state.paused);assert.ok(state.effects.every(e=>!e.fire&&!e.spark));
 await model.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.brand-orbit').dataset.motionStarted==='true');
 await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().time>0);state=await inspect();assert.ok(state.time>0&&state.time<1);assert.equal(state.paused,false);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().paused);const frozen=await inspect();const ringBefore=await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform);await page.waitForTimeout(250);assert.equal(await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).transform),ringBefore,'Offscreen ring freezes with the crank');assert.ok(frozen.paused);assert.equal((await inspect()).time,frozen.time);
 await model.scrollIntoViewIfNeeded();await page.waitForFunction(t=>document.querySelector('.engine3d-host').engine3D.inspect().time>t,frozen.time);
 for(const [time,phase,effect] of [[.7,'intake','fuel'],[2.5,'compression',null],[3.3,'compression','spark'],[3.65,'combustion','fire'],[5.8,'exhaust','exhaust']]){
  state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},time);
  assert.equal(state.cyclePhase,phase);if(effect)assert.ok(state.effects[0][effect],effect+' is visible');
  if(time<3.2)assert.ok(state.effects.every(e=>!e.fire),'No cylinder fires before taking in its first fuel charge');
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const time of [0,3.4,6.8]){
   const geometry=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);const rotor=n.closest('.brand-orbit').querySelector('.orbit-rotor'),tile=rotor.querySelector('.orbit-tile');return {angle:parseFloat(rotor.style.getPropertyValue('--engine-drive-angle')),rotor:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(rotor).transform)[k])],tile:[...['a','b','c','d'].map(k=>new DOMMatrix(getComputedStyle(tile).transform)[k])],animation:getComputedStyle(rotor).animationName};},time);
   assert.equal(geometry.animation,'none','Engine ring has no independent animation');assert.ok(Math.abs(geometry.angle-time*360/27.2)<1e-5);
   const angle=time*2*Math.PI/27.2;assert.ok(Math.abs(geometry.rotor[0]-Math.cos(angle))<1e-5);assert.ok(Math.abs(geometry.rotor[1]-Math.sin(angle))<1e-5);
   assert.ok(Math.abs(geometry.tile[1]+Math.sin(angle))<1e-5,'App face counter-rotates to stay upright');
  }
 }
 console.log('PASS crank-driven app ring, 8:1 gearing, upright faces on mobile and desktop, shared offscreen pause');
 await page.screenshot({path:'test-results/combustion-mobile.png'});
 console.log('PASS viewport start, prewarm without playback, offscreen freeze, resume and four-stroke combustion sequence');
}finally{await browser.close();}
