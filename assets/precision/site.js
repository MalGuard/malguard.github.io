/* Viewport-gated, once-only text. One timer; no offscreen completion. */
(() => {
 'use strict';
 const root=document.documentElement,motion=matchMedia('(prefers-reduced-motion: reduce)'),formatter=new Intl.NumberFormat('en-US');
 const eligible=!motion.matches&&'IntersectionObserver'in window;
 let nodes=[],observer,timer=0,active=null,stopped=false;
 const done=new WeakSet(),visible=new Set(),pending=new Set(),jobs=new WeakMap();
 const complete=node=>{
  done.add(node);pending.delete(node);node.classList.remove('typing');
  node.querySelector(':scope > .type-ink')?.remove();
  if(node.dataset.type)node.dataset.typeState='complete';
  if(node.dataset.reveal)node.dataset.revealState='complete';
  if(node.hasAttribute('data-count-group')){
   node.dataset.countState='complete';node.querySelectorAll('.counter').forEach(n=>{n.dataset.countState='complete';n.querySelector('.count-ink')?.remove();});
  }
  observer?.unobserve(node);
  const nav=node.closest('#navbar');
  if(nav&&[...nav.querySelectorAll('[data-type]')].every(n=>done.has(n)))nav.dataset.navMotion='complete';
 };
 const finish=()=>{stopped=true;clearTimeout(timer);observer?.disconnect();active=null;pending.clear();nodes.forEach(complete);root.classList.remove('type-system');};
 motion.addEventListener('change',e=>{if(e.matches)finish();});
 if(eligible){root.classList.add('type-system');}
 function init(){
  try{
   const shared=document.body.classList.contains('mg-precision-shared');
   if(shared){
    // Public editorial text only, never forms, live verdicts or interactive results.
    const excluded='form,nav,footer,[aria-live],[role="status"],[role="alert"],.result,.verdict,.scan-result,.status,.badge,.counter,.actions,pre,code,[contenteditable],details:not([open]),.site-search'+(document.body.classList.contains('gta-static')?'':',.gta-stage');
    for(const el of document.querySelectorAll('main h1,main h2,main h3,main h4,main p,main .eyebrow,main .kicker,main .gta6-type-line')){
     if(el.closest(excluded)||el.isContentEditable||el.children.length||el.hasAttribute('data-type'))continue;
     const value=el.textContent.trim();
     if(value.length<3||value.length>350||!el.getClientRects().length)continue;
     el.classList.add('type');el.dataset.type=el.matches('h1,h2,h3,h4,.gta6-type-line')?'title':'body';el.dataset.typeState='pending';
     const source=document.createElement('span');source.className='type-source';
     while(el.firstChild)source.append(el.firstChild);el.append(source);
    }
   }
   // Header first, then page text and CTAs. Keep original accessible source text.
   if(document.body.classList.contains('precision-home')||shared){
    const markLink=link=>{
     if(link.querySelector(':scope > .type-source'))return;
     const textNodes=[...link.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
     if(!textNodes.length)return;
     const source=document.createElement('span');source.className='type-source';
     textNodes[0].before(source);textNodes.forEach(n=>source.append(n));
     link.classList.add('type','type-link');link.dataset.type='button';link.dataset.typeState='pending';
    };
    const nav=document.getElementById('navbar');
    if(nav){
     nav.dataset.reveal='nav';nav.dataset.revealState='pending';nav.dataset.navMotion='pending';
     nav.querySelectorAll('.mg-brand,.mg-primary-links a,.nav-download').forEach(link=>{if(link.getClientRects().length)markLink(link);});
    }
    if(shared){
     const actions='main a.btn,main a.button,main a.action-button,main a.release-button,main a.platform-button,main a.download-button,main a.mg-home-product-link,main a.mg-home-product-extra,main a.gta6-button,main a[role="button"],main .actions>a,main .hero-actions>a,main .legacy-actions>a,main .action-group>a,main button.button:not([type="submit"]),main button.btn:not([type="submit"])';
     document.querySelectorAll(actions).forEach(link=>{
      if(!link.closest('form,[aria-live],[role="dialog"],.site-search,.result,.verdict,.scan-result')&&link.getClientRects().length&&!link.hasAttribute('disabled'))markLink(link);
     });
    }else{
     document.querySelectorAll('.hero-actions>a.button,#products a.text-link,#technology a.text-link,.home-tools a.text-link').forEach(markLink);
    }
   }
   nodes=[...document.querySelectorAll('[data-type],[data-reveal],[data-count-group]')].filter(n=>!n.hasAttribute('data-type')||!!n.querySelector(':scope > .type-source'));root.dataset.precisionTypeReady='true';
   if(!eligible||stopped){finish();return;}
   const segmenter=Intl.Segmenter?new Intl.Segmenter('en',{granularity:'grapheme'}):null;
   const inView=node=>{
    if(document.hidden||!visible.has(node))return false;
    const r=node.getBoundingClientRect(),bottom=innerHeight*.94;
    return r.height>0&&Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,0))/r.height>=Math.min(.35,Math.max(.08,innerHeight*.24/Math.max(r.height,1)));
   };
   const stopJob=()=>{if(!active)return;active.elapsed+=performance.now()-active.started;const n=active.node;n.classList.remove('typing');if(active.kind==='text')n.dataset.typeState='paused';if(active.kind==='count'){n.dataset.countState='paused';active.counters.forEach(c=>c.n.dataset.countState='paused');}if(active.kind==='reveal')n.dataset.revealState='paused';active=null;clearTimeout(timer);timer=0;};
   const create=node=>{
    node.dataset.motionStarts=String(Number(node.dataset.motionStarts||0)+1);
    let job={node,elapsed:0,started:0,kind:'reveal',duration:125};
    if(node.dataset.type){
     const source=node.querySelector('.type-source').textContent;
     const pieces=segmenter?[...segmenter.segment(source)].map(p=>p.segment):Array.from(source);
     const ink=document.createElement('span');ink.className='type-ink';ink.setAttribute('aria-hidden','true');
     const text=document.createTextNode(''),cursor=document.createElement('span');cursor.className='type-cursor vertical';ink.append(text,cursor);node.append(ink);
     node.dataset.typeRuns=String(Number(node.dataset.typeRuns||0)+1);
     // Keep visible code-style typing, but never block the queue with long copy.
     const timing=node.dataset.type==='button'
      ? {per:29,min:230,max:455}
      : node.dataset.type==='title'
       ? {per:39,min:335,max:900}
       : {per:21,min:360,max:1320};
     const duration=Math.min(timing.max,Math.max(timing.min,pieces.length*timing.per));
     job={...job,kind:'text',pieces,text,cursor,duration,blink:65};
    }else if(node.hasAttribute('data-count-group')){
     const counters=[...node.querySelectorAll('.counter')].map(n=>{const ink=document.createElement('span');ink.className='count-ink';ink.setAttribute('aria-hidden','true');ink.textContent='0';n.append(ink);n.dataset.countRuns=String(Number(n.dataset.countRuns||0)+1);return {n,ink,value:Number(n.dataset.count)};});
     node.dataset.countRuns=String(Number(node.dataset.countRuns||0)+1);
     job={...job,kind:'count',counters,duration:Math.max(1100,Number(node.dataset.duration)||0)};
    }
    jobs.set(node,job);return job;
   };
   const advance=()=>{
    if(stopped||active||document.hidden)return;
    const node=nodes.find(n=>pending.has(n)&&!done.has(n)&&inView(n));if(!node)return;
    // Locale updates can replace text nodes after registration. The translated text
    // is authoritative: never type over it or dereference a removed source node.
    if(node.hasAttribute('data-type')&&!node.querySelector(':scope > .type-source')){complete(node);advance();return;}
    const job=jobs.get(node)||create(node);active=job;job.started=performance.now();
    if(job.kind==='text'){node.dataset.typeState='typing';node.classList.add('typing');}
    if(job.kind==='reveal')node.dataset.revealState='active';
    if(job.kind==='count'){node.dataset.countState='counting';job.counters.forEach(({n})=>n.dataset.countState='counting');}
    tick();
   };
   const tick=()=>{
    timer=0;if(!active||stopped)return;
    const job=active,node=job.node;
    if(!inView(node)){stopJob();advance();return;}
    const elapsed=job.elapsed+performance.now()-job.started,p=Math.min(1,elapsed/job.duration);
    if(job.kind==='text'){
     const count=Math.min(job.pieces.length,Math.floor(p*job.pieces.length));job.text.textContent=job.pieces.slice(0,count).join('');
     if(p===1)job.cursor.classList.add('cursor-finished');
     if(elapsed>=job.duration+job.blink){complete(node);active=null;advance();return;}
    }else if(job.kind==='count'){
     const prefix=Math.floor(elapsed/36),progress=Math.max(0,Math.min(1,(elapsed-144)/(job.duration-144)));
     const ease=(1-Math.cos(Math.PI*progress))/2;
     job.counters.forEach(({ink,value})=>ink.textContent=formatter.format(prefix<4?Math.min(prefix,value):Math.min(value,Math.max(Math.min(4,value),Math.round(value*ease)))));
     if(p===1){node.dataset.countElapsed=String(Math.round(elapsed));complete(node);active=null;advance();return;}
    }else if(p===1){complete(node);active=null;advance();return;}
    timer=setTimeout(tick,32);
   };
   observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const n=entry.target;if(entry.isIntersecting&&entry.intersectionRatio>=.18){visible.add(n);pending.add(n);}else{visible.delete(n);if(active?.node===n)stopJob();}}
    advance();
   },{rootMargin:'0px 0px -6% 0px',threshold:[0,.18,.35,1]});
   nodes.forEach(n=>observer.observe(n));
   // Some browsers do not dispatch a new threshold crossing when an element
   // is scrolled into view programmatically. Reconcile viewport geometry too.
   let viewportSyncQueued=false;
   const syncViewport=()=>{
    viewportSyncQueued=false;
    for(const n of nodes){
     if(done.has(n))continue;
     // Hidden desktop-only links must never hold the mobile header hostage.
     if(n.closest('#navbar')&&!n.getClientRects().length){complete(n);continue;}
     const r=n.getBoundingClientRect();
     if(r.height>0&&r.bottom>0&&r.top<innerHeight*.94){
      visible.add(n);pending.add(n);
     }else{
      visible.delete(n);
      if(active?.node===n)stopJob();
     }
    }
    advance();
   };
   const queueViewportSync=()=>{
    if(viewportSyncQueued)return;
    viewportSyncQueued=true;requestAnimationFrame(syncViewport);
   };
   addEventListener('scroll',queueViewportSync,{passive:true});
   addEventListener('resize',queueViewportSync,{passive:true});
   queueViewportSync();
   document.addEventListener('visibilitychange',()=>{if(document.hidden)stopJob();else advance();});
   document.querySelectorAll('.product').forEach(card=>card.addEventListener('focusin',()=>{[card,...card.querySelectorAll('[data-type]')].forEach(n=>{if(active?.node===n){clearTimeout(timer);active=null;}complete(n);});advance();}));
  }catch{finish();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Keep the small-screen menu usable without disturbing viewport typing. */
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const details=document.querySelector('.precision-nav-mobile[open]');if(details){details.open=false;details.querySelector('summary')?.focus();}});
