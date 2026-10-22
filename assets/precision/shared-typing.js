/* Scroll-activated, single-queue typewriter for editorial public pages.
   Real text stays in the DOM; only a CSS-generated overlay is animated. */
(()=>{'use strict';
 const root=document.documentElement,body=document.body;
 if(!body?.classList.contains('mg-precision-shared'))return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const isLowPower=()=>reduce.matches||navigator.connection?.saveData;
 if(!('IntersectionObserver' in window)||isLowPower())return;
 const selector='main h1,main h2,main h3,main p';
 const skip='form,nav,footer,[aria-live],.result,.results,.verdict,.scan-result,.scanner-result,.terminal,.code-block,pre,code,.status,.badge,.actions,.mg-app-shell,.mg-interactive,.mg-security-simulator,[contenteditable],details:not([open])';
 const nodes=[];const queue=new Set();const revealed=new WeakSet();const work=new WeakMap();let active=null,timer=0,observer,stopped=false,lastTick=performance.now();
 const segment=typeof Intl.Segmenter==='function'?new Intl.Segmenter(root.lang||'en',{granularity:'grapheme'}):null;
 const parts=txt=>segment?[...segment.segment(txt)].map(x=>x.segment):Array.from(txt);
 const inViewport=el=>{if(document.hidden||!el.isConnected||!queue.has(el))return false;
   const r=el.getBoundingClientRect(),height=Math.max(1,r.height);
   return r.width>0&&r.height>0&&Math.min(r.bottom,innerHeight*.94)-Math.max(0,r.top)>=Math.min(height*.14,innerHeight*.19);
 };
 const cleanup=el=>{if(!el)return;el.classList.remove('mg-precision-type-target');el.classList.add('mg-precision-type-complete');
   el.removeAttribute('data-mg-typed');el.style.removeProperty('--mg-precision-ink');queue.delete(el);revealed.add(el);observer?.unobserve(el);
 };
 const revealAll=()=>{stopped=true;clearTimeout(timer);observer?.disconnect();active=null;nodes.forEach(cleanup);};
 const pause=()=>{if(!active)return;active.elapsed+=performance.now()-active.start;active=null;clearTimeout(timer);};
 const next=()=>{if(stopped||active||document.hidden)return;
   const el=nodes.find(x=>queue.has(x)&&!revealed.has(x)&&inViewport(x));if(!el)return;
   let job=work.get(el);if(!job){const letters=parts(el.getAttribute('data-mg-original')||el.textContent.trim());
     job={el,letters,elapsed:0,duration:Math.max(300,Math.min(el.matches('p')?1200:690,letters.length*(el.matches('p')?15:18))),start:0};
     work.set(el,job);
   }
   active=job;job.start=performance.now();tick();
 };
 function tick(){if(!active||stopped)return;
   const job=active,now=performance.now();lastTick=now;
   if(!inViewport(job.el)){pause();next();return;}
   const elapsed=job.elapsed+now-job.start;
   const count=Math.min(job.letters.length,Math.floor(job.letters.length*Math.min(1,elapsed/job.duration)));
   job.el.setAttribute('data-mg-typed',job.letters.slice(0,count).join(''));
   if(elapsed>=job.duration+85){cleanup(job.el);active=null;timer=setTimeout(next,35);return;}
   timer=setTimeout(tick,30);
 }
 const candidates=[...document.querySelectorAll(selector)];
 for(const el of candidates){
   if(el.closest(skip)||el.isContentEditable||el.children.length||el.hasAttribute('aria-live')||el.hasAttribute('data-mg-no-type'))continue;
   const value=el.textContent.trim();if(value.length<5||value.length>310)continue;
   if(!el.getClientRects().length||getComputedStyle(el).display==='none')continue;
   const color=getComputedStyle(el).color;
   el.style.setProperty('--mg-precision-ink',color);
   el.setAttribute('data-mg-original',value);
   el.setAttribute('data-mg-typed','');
   el.classList.add('mg-precision-type-target');
   nodes.push(el);queue.add(el);
 }
 if(!nodes.length)return;
 const flush=()=>{revealAll();};
 observer=new IntersectionObserver(entries=>{
   for(const e of entries){if(e.isIntersecting)queue.add(e.target);if(!e.isIntersecting&&active?.el===e.target)pause();}
   next();
 },{rootMargin:'0px 0px -6% 0px',threshold:[0,.14,.35,1]});
 nodes.forEach(el=>observer.observe(el));
 reduce.addEventListener?.('change',event=>{if(event.matches)flush()});
 const langWatch=new MutationObserver(flush);langWatch.observe(root,{attributes:true,attributeFilter:['lang','dir']});
 window.addEventListener('pagehide',flush,{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else next()});
 // Restore copy if the animation controller stalls; never leave important text invisible.
 setInterval(()=>{if(stopped)return;if(active&&performance.now()-lastTick>3500&&!document.hidden)flush()},4000);
 window.addEventListener('focus',next);
})();
