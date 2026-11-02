import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8085';assert.equal(new URL(base).hostname,'127.0.0.1');
const browser=await chromium.launch(launchOptions('chromium'));
try{
 const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[],errors=[];
 p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/',{waitUntil:'networkidle'});const model=p.locator('.engine3d-host');await model.scrollIntoViewIfNeeded();await p.waitForTimeout(150);
 assert.equal(await p.locator('.brand-orbit').getAttribute('data-mode'),'engine');assert.ok(await p.locator('.engine3d-poster').isVisible());assert.equal(await model.locator('canvas').count(),0);assert.ok(!requests.some(u=>u.includes('product-engine3d.js')),'Reduced-motion initial load does not download or initialize 3D');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D,{timeout:30000});
 assert.equal(await model.evaluate(n=>n.engine3D.inspect().renderer),'WebGLRenderer');
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('.engine3d-host').engine3D.inspect().paused);
 const state=await model.evaluate(n=>n.engine3D.inspect());await p.waitForTimeout(200);assert.equal(await model.evaluate(n=>n.engine3D.inspect().time),state.time);assert.deepEqual(errors,[]);
 console.log('PASS default homepage reduced-motion poster without 3D download, enabling motion loads real 3D, disabling pauses it');
}finally{await browser.close();}
