import {chromium,launchOptions} from './browser-runtime.mjs';
import {mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'https://127.0.0.1:8443';
if(!['http://127.0.0.1:8085','https://127.0.0.1:8443'].includes(base))throw Error('Local fixture only');
await mkdir('test-results',{recursive:true});
(async()=>{const b=await chromium.launch(launchOptions('chromium'));
for(const width of [320,390,1440])for(const mode of ['merge','orbit','engine']){
 const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'no-preference'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?motion='+mode,{waitUntil:'networkidle'});
 const h=p.locator('.brand-orbit');if(await h.getAttribute('data-mode')!==mode||await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mode/overflow '+width+mode);
 const srcs=await h.locator('img').evaluateAll(ns=>ns.map(n=>n.getAttribute('src')));if(srcs.some(s=>s.includes('product-gta-guard')||s.includes('product-game-scam-guard')||s.includes('/fusion/')))throw Error('Colored mark remains');
 if(mode==='engine'){
  const geometry=await h.evaluate(n=>[...n.querySelectorAll('.motor-unit')].map(u=>{const r=u.querySelector('.motor-rod'),c=u.querySelector('.motor-crank');const rod=new DOMPoint(0,58).matrixTransform(r.getCTM()),pin=new DOMPoint(0,17).matrixTransform(c.getCTM());const volume=new DOMPoint(0,1).matrixTransform(u.querySelector('.motor-combustion').getCTM()),crown=new DOMPoint(0,-8).matrixTransform(u.querySelector('.motor-piston').getCTM());return Math.max(Math.hypot(rod.x-pin.x,rod.y-pin.y),Math.hypot(volume.x-crown.x,volume.y-crown.y));}));if(geometry.some(d=>d>1))throw Error('Disconnected conrod '+geometry);
 }
 if(await h.locator('.orbit-control').textContent()==='Replay animation'){await h.locator('.orbit-control').click();await p.waitForTimeout(100);}
 await h.locator('.orbit-control').click();if(!await h.evaluate(n=>n.classList.contains('is-paused')))throw Error('Pause control state '+width+mode);await p.waitForFunction(()=>[...document.querySelector('.brand-orbit').getAnimations({subtree:true})].filter(a=>a.constructor.name!=='CSSTransition').every(a=>a.playState==='paused'&&!a.pending),null,{timeout:5000});const before=await h.evaluate(n=>n.getAnimations({subtree:true}).filter(a=>a.constructor.name!=='CSSTransition').map(a=>a.currentTime));await p.waitForTimeout(120);const after=await h.evaluate(n=>n.getAnimations({subtree:true}).filter(a=>a.constructor.name!=='CSSTransition').map(a=>a.currentTime));if(before.some((v,i)=>Math.abs(v-after[i])>.2))throw Error('Animation did not pause '+JSON.stringify({width,mode,before,after,debug:await h.evaluate(n=>({cls:n.className,css:getComputedStyle(n.querySelector('.orbit-path')).animationPlayState,states:n.getAnimations({subtree:true}).map(a=>a.playState),label:n.querySelector('button').textContent}))}));await h.locator('.orbit-control').click();
 if(width===1440&&mode==='merge'){
  await p.waitForTimeout(5700);await p.screenshot({path:'test-results/merge-ring-v2.png'});
  await p.waitForTimeout(1600);const expanding=await h.locator('.orbit-path').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).a);if(expanding<=1)throw Error('Ring must expand outward');await p.screenshot({path:'test-results/merge-transition-v2.png'});
  await p.waitForTimeout(3500);if(await h.locator('.orbit-control').textContent()!=='Replay animation')throw Error('Replay');await p.screenshot({path:'test-results/merge-final-v2.png'});await h.locator('.orbit-control').click();await p.waitForTimeout(100);if(Number(await h.locator('.orbit-path').evaluate(n=>getComputedStyle(n).opacity))<.95)throw Error('Replay failed');
 }
 if(width!==320)await p.screenshot({path:`test-results/${mode}-${width}-v2.png`});
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(60);if((await h.locator('.orbit-rotor').evaluate(n=>getComputedStyle(n).animationName))!=='none')throw Error('Reduce');if(errors.length)throw Error(errors.join(';'));console.log('PASS',width,mode);await p.close();
}await b.close();})();
