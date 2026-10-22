// Reduced-motion/weak-GPU and viewport-triggered typography regression.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';
const base='https://127.0.0.1:8443';
for(const name of (process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'])){
 if(!['chromium','webkit'].includes(name))throw Error('Unknown browser');
 const browser=await (name==='chromium'?chromium:webkit).launch(launchOptions(name));
 try{
  for(const width of [320,390,820,1440]){
   const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
   await c.addInitScript(()=>{const saved=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...a){return /webgl/i.test(type)?null:saved.call(this,type,...a)}});
   await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   assert.equal((await p.goto(base+'/')).status(),200);
   await p.waitForFunction(()=>document.querySelector('.flow-stage')?.dataset.renderer==='vector',null,{timeout:10000});
   const d=await p.evaluate(()=>({inner:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(d.scroll<=d.inner+1,'Horizontal overflow '+width);
   assert.equal(await p.locator('.flow-stage svg text').filter({hasText:'undefined'}).count(),0);
   assert.equal(await p.locator('.metric-clarification').count(),1);
   await p.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
   const button=p.locator('#menuBtn');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
   await p.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');
   assert.deepEqual(errors,[]);await c.close();console.log('PASS',name,width,'SVG fallback and responsive navigation');
  }
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:850},reducedMotion:'no-preference'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage();await p.goto(base+'/');
  const title=p.locator('#technology [data-type]').first();
  assert.equal(await title.getAttribute('data-type-state'),'pending');
  await title.scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>['typing','complete'].includes(document.querySelector('#technology [data-type]')?.dataset.typeState),null,{timeout:8000});
  assert.deepEqual(await p.locator('#products .text-link').evaluateAll(a=>a.map(n=>new URL(n.href).pathname)),['/gta-guard.html','/game-scam-guard.html','/threat-radar.html']);
  await c.close();console.log('PASS',name,'viewport typing and product links');
 }finally{await browser.close();}
}
