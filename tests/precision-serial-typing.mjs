// Each visited section runs its own one-item-at-a-time queue and completes offscreen.
// Uses only the local HTTPS fixture; no form submissions or external requests.
import assert from 'node:assert/strict';
import {chromium,webkit,launchOptions} from './browser-runtime.mjs';

const base='https://127.0.0.1:8443';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
const guarded=async context=>{
 await context.route('**/*',r=>
  new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort()
 );
};
const capture=async page=>{
 await page.addInitScript(()=>{
  window.__serialCheck={maximum:0,maximumPerRegion:0,starts:[],violations:[]};
  document.addEventListener('DOMContentLoaded',()=>{
   const selector='[data-type],[data-reveal],[data-count-group]';
   const state=el=>el.dataset.typeState==='typing'||el.dataset.revealState==='active'||el.dataset.countState==='counting';
   const regionOf=node=>{
    const nav=node.closest('#navbar');if(nav)return nav;
    const footer=node.closest('footer');if(footer)return footer;
    const main=node.closest('main');
    if(main){
     let section=node.closest('main section');
     if(section){
      while(section.parentElement){
       const parent=section.parentElement.closest('main section');
       if(!parent)break;
       section=parent;
      }
      return section;
     }
     let top=node;
     while(top.parentElement&&top.parentElement!==main)top=top.parentElement;
     return top.parentElement===main?top:main;
    }
    return node.parentElement||node;
   };
   const check=()=>{
    const active=[...document.querySelectorAll(selector)].filter(state);
    window.__serialCheck.maximum=Math.max(window.__serialCheck.maximum,active.length);
    const groups=new Map();
    for(const node of active){
     const region=regionOf(node);
     groups.set(region,(groups.get(region)||0)+1);
    }
    for(const [region,count] of groups){
     window.__serialCheck.maximumPerRegion=Math.max(window.__serialCheck.maximumPerRegion,count);
     if(count>1)window.__serialCheck.violations.push(
      [...region.querySelectorAll(selector)].filter(state).map(n=>n.id||n.className||n.tagName).join(', ')
     );
    }
   };
   const observer=new MutationObserver(entries=>{
    for(const event of entries){
     if(event.attributeName==='data-motion-starts'){
      const el=event.target;
      window.__serialCheck.starts.push({
       index:[...document.querySelectorAll(selector)].indexOf(el),
       className:typeof el.className==='string'?el.className:'',
       id:el.id,
       at:performance.now()
      });
     }
    }
    check();
   });
   observer.observe(document,{subtree:true,attributes:true,attributeFilter:['data-type-state','data-reveal-state','data-count-state','data-motion-starts']});
   setInterval(check,12);
  },{once:true});
 });
};

for(const engine of engines){
 assert.ok(['chromium','webkit'].includes(engine),'unsupported browser');
 const browser=await (engine==='chromium'?chromium:webkit).launch(launchOptions(engine));
 try{
  // Desktop: all three product cards fit in the same viewport but must
  // animate sequentially, not in parallel.
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:950},reducedMotion:'no-preference'});
  await guarded(context);
  const page=await context.newPage();
  await capture(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(base+'/',{waitUntil:'domcontentloaded'})).status(),200);
  await page.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await page.locator('html').getAttribute('data-precision-motion-order'),'section-serial');
  assert.equal(await page.locator('main .eyebrow[data-type="button"]').count()>0,true,'small labels must participate');
  assert.equal(await page.locator('footer nav a[data-type="button"]').count()>0,true,'footer menu links must participate');
  const cards=page.locator('#products article.product');
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('#products article.product')].every(n=>Number(n.dataset.motionStarts)>0),null,{timeout:45000});
  const result=await page.evaluate(()=>({
   order:[...document.querySelectorAll('#products article.product')].map(n=>({
    time:window.__serialCheck.starts.find(x=>x.className.includes('product ')&&x.className.includes([...n.classList].find(c=>c.startsWith('product-'))))?.at
   })),
   ...window.__serialCheck
  }));
  assert.equal(result.maximumPerRegion,1,'Two animation jobs ran inside one section');
  assert.deepEqual(result.violations,[],'Concurrency violations');
  const times=result.order.map(x=>x.time);
  assert.ok(times.every(Number.isFinite),'all product cards must enter the queue');
  assert.ok(times[0]<times[1]&&times[1]<times[2],'card 1, then 2, then 3 must start in order');
  assert.deepEqual(errors,[],'homepage JS errors');
  await context.close();

  // Mobile: collapsed navigation links are not secretly completed ahead of time.
  const mobile=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},reducedMotion:'no-preference'});
  await guarded(mobile);
  const mp=await mobile.newPage();await capture(mp);
  assert.equal((await mp.goto(base+'/',{waitUntil:'domcontentloaded'})).status(),200);
  await mp.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  await mp.waitForFunction(()=>document.querySelector('#navbar')?.dataset.navigationReady==='true');
  const links=mp.locator('#navLinks a[data-type="button"]');
  assert.ok(await links.count()>=3,'Dynamic dropdown entries must be in the same typing queue');
  await mp.locator('#menuBtn').click();
  await mp.waitForFunction(()=>[...document.querySelectorAll('#navLinks a')].slice(0,3).every(n=>n.dataset.typeState==='complete'),null,{timeout:25000});
  const mobileState=await mp.evaluate(()=>({
   maximum:window.__serialCheck.maximum,
   maximumPerRegion:window.__serialCheck.maximumPerRegion,
   violations:window.__serialCheck.violations,
   navStarts:[...document.querySelectorAll('#navLinks a')].slice(0,3).map(n=>window.__serialCheck.starts.find(e=>e.className.includes('type-link')&&e.index===[...document.querySelectorAll('[data-type],[data-reveal],[data-count-group]')].indexOf(n))?.at)
  }));
  assert.equal(mobileState.maximumPerRegion,1,'mobile menu typing overlapped within navigation');
  assert.deepEqual(mobileState.violations,[]);
  assert.ok(mobileState.navStarts.every(Number.isFinite),'all menu links must type when opened');
  assert.ok(mobileState.navStarts[0]<mobileState.navStarts[1]&&mobileState.navStarts[1]<mobileState.navStarts[2],'dropdown menu must type one link after another');
  await mp.keyboard.press('Escape');
  assert.equal(await mp.locator('#menuBtn').getAttribute('aria-expanded'),'false','Escape navigation remains usable');
  await mobile.close();

  // Once a section has entered the viewport it must finish all its queued
  // text and visuals, even when the visitor scrolls to another section.
  // The new section starts immediately with an independent serial queue.
  const scrollContext=await browser.newContext({ignoreHTTPSErrors:true,
   viewport:{width:390,height:844},reducedMotion:'no-preference'});
  await guarded(scrollContext);
  const sp=await scrollContext.newPage();await capture(sp);
  const scrollErrors=[];sp.on('pageerror',e=>scrollErrors.push(e.message));
  await sp.goto(base+'/',{waitUntil:'domcontentloaded'});
  await sp.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  const paragraph=sp.locator('.hero-description[data-type="body"]');
  await sp.waitForFunction(()=>{
   const n=document.querySelector('.hero-description');
   return n?.dataset.typeState==='typing'&&(n.querySelector('.type-ink')?.textContent.length||0)>5;
  },null,{timeout:12000});
  const started=await paragraph.evaluate(n=>({
   runs:Number(n.dataset.typeRuns),motionStarts:Number(n.dataset.motionStarts),
   progress:n.querySelector('.type-ink')?.textContent.length||0
  }));
  assert.equal(started.runs,1,'hero paragraph only starts once');
  await sp.locator('#technology-title').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
  await sp.waitForFunction(()=>{
   const n=document.querySelector('#technology [data-type]');
   return Number(n?.dataset.typeRuns)>0;
  },null,{timeout:3000});
  const afterScroll=await paragraph.evaluate(n=>({
   state:n.dataset.typeState,
   runs:Number(n.dataset.typeRuns),
   progress:n.querySelector('.type-ink')?.textContent.length||0
  }));
  assert.notEqual(afterScroll.state,'paused','scrolling away must never pause started typography');
  assert.equal(afterScroll.runs,1,'scrolling away must not replay the typewriter');
  assert.ok(afterScroll.state==='complete'||afterScroll.progress>=started.progress,
   'scrolling away must preserve forward progress');
  await sp.waitForFunction(()=>document.querySelector('.hero-description')?.dataset.typeState==='complete',
   null,{timeout:6000});
  await sp.waitForFunction(()=>{
   const hero=document.querySelector('.hero');
   return hero&&[...hero.querySelectorAll('[data-type],[data-reveal],[data-count-group]')]
    .every(n=>n.dataset.typeState==='complete'||n.dataset.revealState==='complete'||n.dataset.countState==='complete');
  },null,{timeout:12000});
  const completed=await paragraph.evaluate(n=>({
   state:n.dataset.typeState,runs:Number(n.dataset.typeRuns),
   motionStarts:Number(n.dataset.motionStarts)
  }));
  assert.equal(completed.state,'complete','offscreen hero must complete');
  assert.equal(completed.runs,1);
  assert.equal(completed.motionStarts,started.motionStarts);
  await paragraph.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
  await sp.waitForTimeout(150);
  assert.equal(await paragraph.getAttribute('data-type-runs'),'1',
   'scrolling back must not restart a completed animation');
  const concurrency=await sp.evaluate(()=>window.__serialCheck);
  assert.ok(concurrency.maximumPerRegion<=1,'within-section items must remain sequential');
  assert.deepEqual(concurrency.violations,[],'two jobs from one section overlapped');
  assert.deepEqual(scrollErrors,[],'scrolling must not raise JS exceptions');
  await scrollContext.close();

  // Accessibility: never conceal copy for reduced-motion users.
  const reduce=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
  await guarded(reduce);
  const rp=await reduce.newPage();
  await rp.goto(base+'/',{waitUntil:'domcontentloaded'});
  await rp.waitForFunction(()=>document.documentElement.dataset.precisionTypeReady==='true');
  assert.equal(await rp.locator('html.type-system').count(),0,'reduced motion must show content immediately');
  assert.equal(await rp.locator('#products .product').first().evaluate(e=>getComputedStyle(e).opacity),'1');
  await reduce.close();
  console.log('PASS strict serial typing',engine,'cards, menu, text, and reduced motion');
 }finally{await browser.close();}
}
