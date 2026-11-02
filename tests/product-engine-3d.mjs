import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base=process.env.TEST_BASE_URL||'https://127.0.0.1:8443';
assert.ok(['http://127.0.0.1:8085','https://127.0.0.1:8443'].includes(base),'Local benign fixture only');
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch(launchOptions('chromium'));
try{
 for(const width of [320,390,820,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000},reducedMotion:'no-preference'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?motion=engine',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.engine3d-host')?.engine3D,{timeout:20000});
  const model=page.locator('.engine3d-host');
  assert.equal(await page.locator('.orbit-item img').count(),8);assert.equal(await page.locator('.orbit-item svg,.orbit-engine').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  for(const time of [0,.4,.9,1.6,2.4,3.3,4.8]){
   const state=await model.evaluate((n,t)=>{n.engine3D.renderAt(t);return n.engine3D.inspect();},time);
   assert.equal(state.renderer,'WebGLRenderer');assert.equal(state.camera,'PerspectiveCamera');assert.equal(state.cylinders,4);
   assert.ok(state.meshes>=100);assert.ok(state.triangles>50000&&state.triangles<150000);assert.ok(state.drawCalls<280);
   assert.ok(state.rodErrors.every(v=>v<1e-5),'Rigid rod ends stay connected throughout a rotation');
  }
  const views=await model.evaluate(n=>{n.engine3D.setYaw(0);const a=n.engine3D.capture();n.engine3D.setYaw(.65);const b=n.engine3D.capture();n.engine3D.setYaw(0);return {different:a!==b,bytes:a.length};});
  assert.ok(views.different&&views.bytes>10000,'Changing the view changes the real rendered scene');
  await model.evaluate(n=>n.engine3D.setPaused(false));await page.waitForTimeout(180);
  await page.locator('.orbit-control').click();await page.waitForTimeout(60);
  const frozen=await model.evaluate(n=>n.engine3D.inspect());assert.ok(frozen.paused);await page.waitForTimeout(150);assert.equal((await model.evaluate(n=>n.engine3D.inspect())).time,frozen.time);
  const canvas=page.locator('.engine3d-canvas');const bounds=await canvas.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.4,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.5,{steps:4});await page.mouse.up();
  assert.ok(Math.abs((await model.evaluate(n=>n.engine3D.inspect())).yaw)>.1,'Pointer drag rotates the model');
  await page.screenshot({path:`test-results/physical-engine-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);assert.ok((await model.evaluate(n=>n.engine3D.inspect())).paused);assert.equal(await page.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).animationName),'none');
  if(width===1440){await model.evaluate(n=>n.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>document.querySelector('.engine3d-host').dataset.renderState==='poster');assert.ok(await page.locator('.engine3d-poster').isVisible());}
  assert.deepEqual(errors,[]);await context.close();console.log('PASS real 3D, view rotation, rigid mechanism, pause and layout',width);
 }
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:1000}});
 await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
 const page=await context.newPage();await page.goto(base+'/?motion=engine',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('.engine3d-host')?.dataset.renderState==='poster');
 assert.ok(await page.locator('.engine3d-poster').isVisible());assert.ok(await page.locator('.engine3d-poster').evaluate(i=>i.complete&&i.naturalWidth>0));
 await context.close();console.log('PASS actual 3D-rendered poster fallback without WebGL');
 const light=await browser.newPage({ignoreHTTPSErrors:true});const requests=[];light.on('request',r=>requests.push(r.url()));await light.goto(base+'/?motion=orbit',{waitUntil:'networkidle'});
 assert.ok(!requests.some(u=>u.includes('product-engine3d.js')),'Continuous orbit does not load the 3D library');assert.equal(await light.locator('.engine3d-canvas').count(),0);await light.close();console.log('PASS no 3D download on other variants');
}finally{await browser.close();}
