/* Once-visible motion continues to completion offscreen; each section has one ordered queue. */
(() => {
 'use strict';
 const root=document.documentElement,motion=matchMedia('(prefers-reduced-motion: reduce)'),formatter=new Intl.NumberFormat('en-US');
 if(document.body?.classList.contains('mg-precision-shared'))root.dataset.experienceReady='true';
 const eligible=!motion.matches&&'IntersectionObserver'in window;
 // Only one active item per semantic section. An already-started section
 // keeps going after scroll; a new section can animate independently.
 let nodes=[],observer,timer=0,stopped=false;const active=new Map();
 root.dataset.precisionMotionOrder='section-serial';
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
   nodes=[...document.querySelectorAll('[data-type],[data-reveal],[data-count-group]')].filter(n=>!n.hasAttribute('data-type')||!!n.querySelector(':scope > .type-source'));
   // Group content at the highest semantic section under main so the three
   // product cards remain in a single sequential queue. Navbar and footer
   // have independent queues. Each entry can be scheduled only after it has
   // intersected the viewport at least once.
   const regionOf=node=>{
    const nav=node.closest('#navbar');if(nav)return nav;
    const footer=node.closest('footer');if(footer)return footer;
    const main=node.closest('main');
    if(main){
     let section=node.closest('main section');
     if(section){
      while(section.parentElement){
       const parentSection=section.parentElement.closest('main section');
       if(!parentSection)break;
       section=parentSection;
      }
      return section;
     }
     let top=node;
     while(top.parentElement&&top.parentElement!==main)top=top.parentElement;
     return top.parentElement===main?top:main;
    }
    return node.parentElement||node;
   };
   const regions=new Map(),activatedRegions=new Set();
   for(const node of nodes){
    const region=regionOf(node);
    if(!regions.has(region))regions.set(region,[]);
    regions.get(region).push(node);
   }
   // The homepage product artwork is already eager-loaded by the browser.
   // Order each card as card -> title -> image -> supporting copy so users
   // see what the product is before its image, without waiting for all labels.
   // Keep all three cards in one serial section queue.
   if(document.body.classList.contains('precision-home')){
    const section=document.getElementById('products');
    const original=regions.get(section);
    if(original){
     const reordered=[],seen=new Set();
     for(const node of original){
      const card=node.closest('#products article.product');
      if(!card){reordered.push(node);continue;}
      if(seen.has(card))continue;
      seen.add(card);
      const members=original.filter(item=>item===card||card.contains(item));
      const title=members.find(item=>item.matches('h3[data-type]'));
      const picture=members.find(item=>item.matches('.product-art[data-reveal]'));
      reordered.push(card);
      if(title)reordered.push(title);
      if(picture)reordered.push(picture);
      for(const item of members){
       if(item!==card&&item!==title&&item!==picture)reordered.push(item);
      }
     }
     regions.set(section,reordered);
    }
   }
   root.dataset.precisionTypeReady='true';
   if(!eligible||stopped){finish();return;}
   const segmenter=Intl.Segmenter?new Intl.Segmenter('en',{granularity:'grapheme'}):null;
   const inView=node=>{
    if(document.hidden||!visible.has(node))return false;
    const r=node.getBoundingClientRect(),bottom=innerHeight*.97;
    // Start shortly after new copy, menus, or images enter the viewing area.
    return r.height>0&&Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,0))/r.height>=Math.min(.18,Math.max(.045,innerHeight*.10/Math.max(r.height,1)));
   };
   const create=node=>{
    node.dataset.motionStarts=String(Number(node.dataset.motionStarts||0)+1);
     const inProductCard=!!node.closest('#products article.product');
     const inProductSection=!!node.closest('#products');
     let job={node,elapsed:0,started:0,kind:'reveal',
      duration:inProductCard?(node.dataset.reveal==='visual'?55:45):node.dataset.reveal==='visual'?350:125};
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
     // Product-only override keeps the three site-wide timing contracts intact.
     const productDuration=node.dataset.type==='title'
      ? Math.min(135,Math.max(60,pieces.length*5))
      : Math.min(155,Math.max(65,pieces.length*3));
     const duration=inProductSection?productDuration
      : Math.min(timing.max,Math.max(timing.min,pieces.length*timing.per));
     job={...job,kind:'text',pieces,text,cursor,duration,blink:65};
    }else if(node.hasAttribute('data-count-group')){
     const counters=[...node.querySelectorAll('.counter')].map(n=>{const ink=document.createElement('span');ink.className='count-ink';ink.setAttribute('aria-hidden','true');ink.textContent='0';n.append(ink);n.dataset.countRuns=String(Number(n.dataset.countRuns||0)+1);return {n,ink,value:Number(n.dataset.count)};});
     node.dataset.countRuns=String(Number(node.dataset.countRuns||0)+1);
     job={...job,kind:'count',counters,duration:600};
    }
    jobs.set(node,job);return job;
   };
   const advance=()=>{
    if(stopped)return;
    // One running job per section, never a global one-job bottleneck.
    // Once ANY part of a section has been seen, finish that section's
    // complete ordered queue, even while the visitor scrolls elsewhere.
    const busy=new Set([...active.keys()].map(regionOf));
    for(const [region,items] of regions){
     if(busy.has(region)||!activatedRegions.has(region))continue;
     for(const node of items){
      if(done.has(node)||active.has(node))continue;
      // Unopened navigation links must type when the user opens the menu,
      // not invisibly while it is collapsed.
      if(node.closest('#navLinks')&&document.getElementById('navLinks')?.hidden)continue;
      // Hidden responsive-only links do not block visible navigation.
      if(node.closest('#navbar')&&!node.getClientRects().length)continue;
      if(node.hasAttribute('data-type')&&!node.querySelector(':scope > .type-source')){complete(node);continue;}
      const job=jobs.get(node)||create(node);
      active.set(node,job);job.started=performance.now();
      if(job.kind==='text'){node.dataset.typeState='typing';node.classList.add('typing');}
      if(job.kind==='reveal')node.dataset.revealState='active';
      if(job.kind==='count'){node.dataset.countState='counting';job.counters.forEach(({n})=>n.dataset.countState='counting');}
      busy.add(region);
      break;
     }
    }
    if(active.size&&!timer)timer=setTimeout(tick,16);
   };
   const tick=()=>{
    timer=0;if(stopped)return;
    for(const [node,job] of active){
     // Once triggered, progress never depends on the current scroll position.
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
     const node=entry.target;
     if(entry.isIntersecting&&entry.intersectionRatio>=.06){
      visible.add(node);pending.add(node);activatedRegions.add(regionOf(node));
     }else visible.delete(node);
    }
    // Reconcile viewport geometry without ever pausing a started job.
    queueViewportSync();
   },{rootMargin:'0px 0px -3% 0px',threshold:[0,.06,.18,.35,1]});
   nodes.forEach(node=>observer.observe(node));
   let viewportSyncQueued=false;
   const syncViewport=()=>{
    viewportSyncQueued=false;
    for(const node of nodes){
     if(done.has(node))continue;
     // Closed dropdown links are deferred until the menu actually opens.
     if(node.closest('#navbar')&&!node.getClientRects().length){
      if(node.closest('.nav-links,.mg-primary-links'))continue;
      complete(node);continue;
     }
     const r=node.getBoundingClientRect();
     if(r.height>0&&r.bottom>0&&r.top<innerHeight*.97){
      visible.add(node);
      if(inView(node)){pending.add(node);activatedRegions.add(regionOf(node));}
     }else visible.delete(node);
    }
    advance();
   };
   const queueViewportSync=()=>{
    if(viewportSyncQueued)return;
    viewportSyncQueued=true;requestAnimationFrame(syncViewport);
   };
   addEventListener('scroll',queueViewportSync,{passive:true});
   addEventListener('resize',queueViewportSync,{passive:true});
   document.getElementById('menuBtn')?.addEventListener('click',queueViewportSync);
   queueViewportSync();
   document.addEventListener('visibilitychange',()=>{
    // Rendering can be throttled in background tabs, but scrolling is never
    // a reason to pause an animation already activated in the viewport.
    if(!document.hidden){queueViewportSync();advance();}
   });
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
