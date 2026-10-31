/* Viewport-gated, once-only text. One timer; no offscreen completion. */
(() => {
 'use strict';
 const root=document.documentElement,motion=matchMedia('(prefers-reduced-motion: reduce)'),formatter=new Intl.NumberFormat('en-US');
 if(document.body?.classList.contains('mg-precision-shared'))root.dataset.experienceReady='true';
 const eligible=!motion.matches&&'IntersectionObserver'in window;
 // Never animate two items at once: headline, copy, menus, visuals, and counters
 // all share ONE ordered, viewport-gated queue.
 let nodes=[],observer,timer=0,stopped=false;const active=new Map(),maxActive=1;
 root.dataset.precisionMotionOrder='strict-serial';
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
  // Collapsed menus are not blocking the navigation entrance. Their links
  // retain pending state and animate strictly in order once opened.
  if(nav&&[...nav.querySelectorAll('[data-type]')].every(n=>done.has(n)||!n.getClientRects().length))nav.dataset.navMotion='complete';
 };
 const finish=()=>{stopped=true;clearTimeout(timer);observer?.disconnect();active.clear();pending.clear();nodes.forEach(complete);root.classList.remove('type-system');};
 motion.addEventListener('change',e=>{if(e.matches)finish();});
 if(eligible){root.classList.add('type-system');}
 function init(){
  // DOMContentLoaded and the late interactive fallback may both fire.
  if(root.dataset.precisionTypeReady==='true')return;
  if(document.body.classList.contains('mg-precision-shared'))root.dataset.experienceReady='true';
  try{
   const shared=document.body.classList.contains('mg-precision-shared');
   if(shared){
    // Public editorial text only, never forms, live verdicts or interactive results.
    const excluded='form,nav,footer,[aria-live],[role="status"],[role="alert"],.result,.verdict,.scan-result,.status,.badge,.counter,.actions,pre,code,[contenteditable],details:not([open]),.site-search,.scam-model-composition'+(document.body.classList.contains('gta-static')?'':',.gta-stage');
    for(const el of document.querySelectorAll('main h1,main h2,main h3,main h4,main p,main .eyebrow,main .kicker,main .gta6-type-line')){
     if(el.closest(excluded)||el.isContentEditable||el.hasAttribute('data-type')||el.parentElement?.closest('[data-type]')||el.querySelector('.gta6-type-line')||[...el.children].some(child=>!child.matches('span,strong,em,b,i,br')))continue;
     const value=el.textContent.trim();
     if(value.length<3||value.length>350||!el.getClientRects().length)continue;
     el.classList.add('type');el.dataset.type=el.matches('h1,h2,h3,h4,.gta6-type-line')?'title':'body';el.dataset.typeState='pending';
     const source=document.createElement('span');source.className='type-source';
     while(el.firstChild)source.append(el.firstChild);el.append(source);
    }
    for(const visual of document.querySelectorAll('main img,main svg[role="img"],main .chart svg')){
     if(visual.closest('form,[aria-live],[role="status"],[role="alert"],.result,.verdict,.scan-result,button')||visual.hasAttribute('data-reveal')||visual.closest('[data-reveal="visual"]'))continue;
     visual.dataset.reveal='visual';visual.dataset.revealState='pending';
    }
   }
   // Header first, then page text and CTAs. Keep original accessible source text.
   if(document.body.classList.contains('precision-home')||shared){
    // Wrap only direct text nodes; preserve SVG icons, links, layout and
    // accessibility semantics. Source copy remains available to screen readers.
    const markLink=link=>{
     if(link.hasAttribute('data-type')||link.querySelector(':scope > .type-source'))return;
     const textNodes=[...link.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
     if(!textNodes.length)return;
     const source=document.createElement('span');source.className='type-source';
     textNodes[0].before(source);textNodes.forEach(n=>source.append(n));
     link.classList.add('type','type-link');link.dataset.type='button';link.dataset.typeState='pending';
    };
    const nav=document.getElementById('navbar');
    if(nav){
     nav.dataset.reveal='nav';nav.dataset.revealState='pending';nav.dataset.navMotion='pending';
     nav.querySelectorAll('.mg-brand,.mg-primary-links a,.nav-links a,.nav-links .mg-menu-label,.nav-download').forEach(markLink);
    }
    if(shared){
     const actions='main a.btn,main a.button,main a.action-button,main a.release-button,main a.platform-button,main a.download-button,main a.mg-home-product-link,main a.mg-home-product-extra,main a.ai-product-primary,main a.ai-platform-action,main a.gta6-button,main a[role="button"],main .actions>a,main .hero-actions>a,main .legacy-actions>a,main .action-group>a';
     document.querySelectorAll(actions).forEach(link=>{
      if(!link.closest('form,[aria-live],[role="dialog"],.site-search,.result,.verdict,.scan-result')&&link.getClientRects().length&&!link.hasAttribute('disabled'))markLink(link);
     });
    }else{
     // All editorial copy on the homepage uses the same order: headings,
     // small labels, CTAs, counters and footer navigation. Never wrap inputs
     // or live security verdicts, and never retype an already prepared node.
     document.querySelectorAll('.hero-actions>a.button,#products a.text-link,#technology a.text-link,.home-tools a.text-link,main .eyebrow,main .metric-clarification,main .activity-caption>span,main .metric dt,main .product .index,main .product .status,main .gta-vi-badge,main #products a.text-link,main #technology .principles .index,footer nav h2,footer nav a,footer .footer-brand p,footer .footer-bottom>span,footer .footer-bottom>a').forEach(el=>{
      if(el.closest('form,[aria-live],[role="status"],[role="alert"],.result,.verdict,.scan-result')||!el.textContent.trim()||!el.getClientRects().length) return;
      markLink(el);
     });
    }
   }
   nodes=[...document.querySelectorAll('[data-type],[data-reveal],[data-count-group]')].filter(n=>!n.hasAttribute('data-type')||!!n.querySelector(':scope > .type-source'));root.dataset.precisionTypeReady='true';
   if(!eligible||stopped){finish();return;}
   const segmenter=Intl.Segmenter?new Intl.Segmenter('en',{granularity:'grapheme'}):null;
   const inView=node=>{
    if(document.hidden||!visible.has(node))return false;
    const r=node.getBoundingClientRect(),bottom=innerHeight*.97;
    // Start shortly after new copy, menus, or images enter the viewing area.
    return r.height>0&&Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,0))/r.height>=Math.min(.18,Math.max(.045,innerHeight*.10/Math.max(r.height,1)));
   };
   // Preserve elapsed time and the visible partial ink while a different
   // viewport region takes over. Returning resumes the SAME job and cursor.
   const stopJob=node=>{
    const job=active.get(node);if(!job)return;
    job.elapsed+=Math.max(0,performance.now()-job.started);
    node.classList.remove('typing');
    if(job.kind==='text')node.dataset.typeState='paused';
    if(job.kind==='count'){node.dataset.countState='paused';job.counters.forEach(c=>c.n.dataset.countState='paused');}
    if(job.kind==='reveal')node.dataset.revealState='paused';
    active.delete(node);
   };
   const create=node=>{
    node.dataset.motionStarts=String(Number(node.dataset.motionStarts||0)+1);
     let job={node,elapsed:0,started:0,kind:'reveal',duration:node.dataset.reveal==='visual'?350:125};
    if(node.dataset.type){
     const source=node.querySelector('.type-source').textContent;
     const pieces=segmenter?[...segmenter.segment(source)].map(p=>p.segment):Array.from(source);
     const ink=document.createElement('span');ink.className='type-ink';ink.setAttribute('aria-hidden','true');
      const sourceRect=node.querySelector(':scope > .type-source').getBoundingClientRect(),nodeRect=node.getBoundingClientRect();
      ink.style.left=`${sourceRect.left-nodeRect.left}px`;ink.style.top=`${sourceRect.top-nodeRect.top}px`;ink.style.width=`${sourceRect.width}px`;
     const text=document.createTextNode(''),cursor=document.createElement('span');cursor.className='type-cursor vertical';ink.append(text,cursor);node.append(ink);
     node.dataset.typeRuns=String(Number(node.dataset.typeRuns||0)+1);
     // Keep visible code-style typing, but never block the queue with long copy.
     const timing=node.dataset.type==='button'
      ? {per:15,min:130,max:280}
      : node.dataset.type==='title'
       ? {per:18,min:180,max:480}
       : {per:10,min:200,max:650};
     const duration=Math.min(timing.max,Math.max(timing.min,pieces.length*timing.per));
     job={...job,kind:'text',pieces,text,cursor,duration,blink:65};
    }else if(node.hasAttribute('data-count-group')){
     const counters=[...node.querySelectorAll('.counter')].map(n=>{const ink=document.createElement('span');ink.className='count-ink';ink.setAttribute('aria-hidden','true');ink.textContent='0';n.append(ink);n.dataset.countRuns=String(Number(n.dataset.countRuns||0)+1);return {n,ink,value:Number(n.dataset.count)};});
     node.dataset.countRuns=String(Number(node.dataset.countRuns||0)+1);
     job={...job,kind:'count',counters,duration:600};
    }
    jobs.set(node,job);return job;
   };
   // A deliberate scroll hands ownership to content entering the viewport.
   // Earlier, still-partially-visible text must not hold the next section
   // hostage. Jobs behind the viewport frontier stay paused until the user
   // scrolls back to them. Normal stationary reading remains DOM-ordered.
   let viewportFrontier=null,scrollDirection=0,lastScrollY=scrollY;
   let lastViewportVisible=new Set();
   const canRun=n=>pending.has(n)&&!done.has(n)&&!active.has(n)&&inView(n);
   const menuOpen=()=>{const menu=document.getElementById('navLinks');return !!menu&&!menu.hidden;};
   const advance=()=>{
    if(stopped||document.hidden)return;
    const menuActive=menuOpen();
    if(menuActive){
     for(const node of [...active.keys()])if(!node.closest('#navLinks'))stopJob(node);
    }
    while(active.size<maxActive){
     const node=menuActive
      ? nodes.find(n=>n.closest('#navLinks')&&canRun(n))
      : nodes.find((n,index)=>((viewportFrontier===null)||index>=viewportFrontier)&&canRun(n));
     if(!node)break;
     if(node.hasAttribute('data-type')&&!node.querySelector(':scope > .type-source')){complete(node);continue;}
     const job=jobs.get(node)||create(node);active.set(node,job);job.started=performance.now();
     if(job.kind==='text'){node.dataset.typeState='typing';node.classList.add('typing');}
     if(job.kind==='reveal')node.dataset.revealState='active';
     if(job.kind==='count'){node.dataset.countState='counting';job.counters.forEach(({n})=>n.dataset.countState='counting');}
    }
    if(active.size&&!timer)timer=setTimeout(tick,16);
   };
   const tick=()=>{
    timer=0;if(stopped)return;
    for(const [node,job] of active){
     if(!inView(node)){stopJob(node);continue;}
     const elapsed=job.elapsed+performance.now()-job.started,p=Math.min(1,elapsed/job.duration);
     if(job.kind==='text'){
      const count=Math.min(job.pieces.length,Math.floor(p*job.pieces.length));job.text.textContent=job.pieces.slice(0,count).join('');
      if(p===1)job.cursor.classList.add('cursor-finished');
      if(elapsed>=job.duration+job.blink){complete(node);active.delete(node);}
     }else if(job.kind==='count'){
      const ease=(1-Math.cos(Math.PI*p))/2;
      job.counters.forEach(({ink,value})=>ink.textContent=formatter.format(Math.round(value*ease)));
      if(p===1){node.dataset.countElapsed=String(Math.round(elapsed));complete(node);active.delete(node);}
     }else if(p===1){complete(node);active.delete(node);}
    }
    advance();
   };
   observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
     const n=entry.target;
     if(entry.isIntersecting&&entry.intersectionRatio>=.06){visible.add(n);pending.add(n);}
     else{visible.delete(n);stopJob(n);}
    }
    // The scroll reconciliation owns priority. Observer callbacks can
    // arrive before or after the scroll event on slower mobile browsers.
    queueViewportSync();
   },{rootMargin:'0px 0px -3% 0px',threshold:[0,.06,.18,.35,1]});
   nodes.forEach(n=>observer.observe(n));
   // Some browsers do not dispatch a new threshold crossing when an element
   // is scrolled into view programmatically. Reconcile viewport geometry too.
   let viewportSyncQueued=false;
   const syncViewport=()=>{
    viewportSyncQueued=false;
    const seenNow=new Set();
    for(const n of nodes){
     if(done.has(n))continue;
     // Hidden desktop-only links must never hold the mobile header hostage.
     // A closed responsive menu is deferred, not marked complete: opening it
     // later must still type entry 1, then 2, then 3, without parallel work.
     if(n.closest('#navbar')&&!n.getClientRects().length){
      if(n.closest('.nav-links,.mg-primary-links'))continue;
      complete(n);continue;
     }
     const r=n.getBoundingClientRect();
     if(r.height>0&&r.bottom>0&&r.top<innerHeight*.97){
      visible.add(n);pending.add(n);
      // The job itself must be visible to start, not just its parent section.
      if(inView(n))seenNow.add(n);
     }else{
      visible.delete(n);
      stopJob(n);
     }
    }
    if(scrollDirection!==0){
     // At the top of the page, let the brand and headings complete normally.
     if(scrollY<8)viewportFrontier=null;
     else{
      const entrants=nodes.filter(n=>seenNow.has(n)&&!lastViewportVisible.has(n)&&!done.has(n));
      // When many nodes enter together, preserve their DOM reading order.
      // Reverse scrolling chooses the earliest newly visible node, allowing
      // older, interrupted material to resume rather than restart.
      if(entrants.length){
       const target=entrants[0];
       viewportFrontier=nodes.indexOf(target);
       for(const node of [...active.keys()]){
        if(node!==target&&(!menuOpen()||!node.closest('#navLinks')))stopJob(node);
       }
      }else if(viewportFrontier!==null){
       // If the current item has moved offscreen, the next visible item
       // should start immediately; a stale frontier must never block it.
       const remaining=nodes.slice(viewportFrontier).some(n=>seenNow.has(n)&&!done.has(n));
       if(!remaining){
        const first=nodes.find(n=>seenNow.has(n)&&!done.has(n));
        if(first)viewportFrontier=nodes.indexOf(first);
       }
      }
     }
    }
    lastViewportVisible=seenNow;
    scrollDirection=0;
    advance();
   };
   const queueViewportSync=()=>{
    if(viewportSyncQueued)return;
    viewportSyncQueued=true;requestAnimationFrame(syncViewport);
   };
   addEventListener('scroll',()=>{
    const current=scrollY,delta=current-lastScrollY;
    if(Math.abs(delta)>1)scrollDirection=delta>0?1:-1;
    lastScrollY=current;
    queueViewportSync();
   },{passive:true});
   addEventListener('resize',queueViewportSync,{passive:true});
   queueViewportSync();
   document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const n of active.keys())stopJob(n);}else advance();});
   document.querySelectorAll('.product').forEach(card=>card.addEventListener('focusin',()=>{[card,...card.querySelectorAll('[data-type],[data-reveal]')].forEach(n=>{active.delete(n);complete(n);});advance();}));
  }catch{finish();}
 }
 // Defer scripts execute while readyState is "interactive". The shared
 // navigation script runs after this controller and rebuilds #navLinks;
 // initialize only at DOMContentLoaded so we type the FINAL menu entries.
 if(document.readyState==='loading'||document.readyState==='interactive'){
  document.addEventListener('DOMContentLoaded',init,{once:true});
  // If inserted after DOMContentLoaded while still "interactive", avoid a
  // permanently pending page; this task runs after the remaining defer scripts.
  if(document.readyState==='interactive')setTimeout(init,0);
 }else init();
})();

/* Keep the small-screen menu usable without disturbing viewport typing. */
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const details=document.querySelector('.precision-nav-mobile[open]');if(details){details.open=false;details.querySelector('summary')?.focus();}});

/* Navigation must never wait for the decorative typewriter queue. */
document.addEventListener('pointerdown',e=>{const a=e.target.closest?.('a[href]');if(!a)return;const href=a.getAttribute('href');if(!href||href.startsWith('#')||a.target==='_blank'||e.button>0)return;document.documentElement.classList.add('mg-navigating');},{capture:true,passive:true});
