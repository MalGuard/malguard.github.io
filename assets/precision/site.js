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
 };
 const finish=()=>{stopped=true;clearTimeout(timer);observer?.disconnect();active=null;pending.clear();nodes.forEach(complete);root.classList.remove('type-system');};
 window.addEventListener('error',finish,{once:true});window.addEventListener('unhandledrejection',finish,{once:true});
 motion.addEventListener('change',e=>{if(e.matches)finish();});
 if(eligible){root.classList.add('type-system');}
 function init(){
  try{
   nodes=[...document.querySelectorAll('[data-type],[data-reveal],[data-count-group]')];root.dataset.precisionTypeReady='true';
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
     const text=document.createTextNode(''),cursor=document.createElement('span');cursor.className='type-cursor '+(node.dataset.type==='title'?'vertical':'underscore');ink.append(text,cursor);node.append(ink);
     node.dataset.typeRuns=String(Number(node.dataset.typeRuns||0)+1);
     job={...job,kind:'text',pieces,text,cursor,duration:Math.min(node.dataset.type==='title'?560:760,Math.max(240,pieces.length*14)),blink:100};
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
    timer=setTimeout(tick,24);
   };
   observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const n=entry.target;if(entry.isIntersecting&&entry.intersectionRatio>=.18){visible.add(n);pending.add(n);}else{visible.delete(n);if(active?.node===n)stopJob();}}
    advance();
   },{rootMargin:'0px 0px -6% 0px',threshold:[0,.18,.35,1]});
   nodes.forEach(n=>observer.observe(n));
   document.addEventListener('visibilitychange',()=>{if(document.hidden)stopJob();else advance();});
   document.querySelectorAll('.product').forEach(card=>card.addEventListener('focusin',()=>{[card,...card.querySelectorAll('[data-type]')].forEach(n=>{if(active?.node===n){clearTimeout(timer);active=null;}complete(n);});advance();}));
  }catch{finish();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
