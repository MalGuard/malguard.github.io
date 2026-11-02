import assert from 'node:assert/strict';
import {chromium,launchOptions} from './browser-runtime.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8085';assert.equal(new URL(base).hostname,'127.0.0.1');
const b=await chromium.launch(launchOptions('chromium'));
try{
 const p=await b.newPage({viewport:{width:390,height:500},isMobile:true,hasTouch:true}),requests=[],errors=[];
 p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.__engineLongTasks=[];new PerformanceObserver(l=>window.__engineLongTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 const client=await p.context().newCDPSession(p);await client.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.goto(base+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
 assert.equal(await p.locator('.engine3d-canvas').count(),0,'Below-fold engine never creates a GPU scene during initial loading');assert.ok(!requests.some(u=>u.includes('engine-studio-pmrem')),'No environment fetch until the engine is visible');
 const menu=p.locator('#menuBtn'),box=await menu.boundingBox(),start=Date.now();await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await p.waitForFunction(()=>document.querySelector('#menuBtn').getAttribute('aria-expanded')==='true');const interaction=Date.now()-start;assert.ok(interaction<1200,'Initial mobile navigation responds without waiting for 3D');await p.keyboard.press('Escape');
 await p.locator('.engine3d-host').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.engine3d-host')?.engine3D,{timeout:30000});
 const tasks=await p.evaluate(()=>window.__engineLongTasks),maximum=Math.max(0,...tasks);assert.ok(maximum<900,'Studio preparation must not create multi-second main-thread tasks');
 const state=await p.locator('.engine3d-host').evaluate(n=>{n.engine3D.renderAt(1.43);return n.engine3D.inspect()});assert.equal(state.startupPhase,'combustion');assert.ok(state.effects[0].fire);assert.equal(state.crankAngle,state.restAngle);assert.equal(state.meshes,222);assert.ok(state.triangles<150000);assert.deepEqual(errors,[]);
 console.log('PASS mobile CPU 4x slower: initial navigation',interaction,'ms; longest task',Math.round(maximum),'ms; deferred GPU scene; original geometry and combustion');
 // Browsers without native gzip streams keep the same appearance via the bundled fallback.
 const legacy=await b.newPage({viewport:{width:1440,height:1000}});await legacy.addInitScript(()=>{window.DecompressionStream=undefined;});await legacy.goto(base+'/?motion=engine');await legacy.waitForFunction(()=>document.querySelector('.engine3d-host')?.engine3D,{timeout:30000});assert.equal(await legacy.locator('.engine3d-host').evaluate(n=>n.engine3D.inspect().renderer),'WebGLRenderer');await legacy.close();console.log('PASS gzip fallback without DecompressionStream');
}finally{await b.close();}
