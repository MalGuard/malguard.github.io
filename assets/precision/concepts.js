/* One active-visible timeline. SVG/CSS motion and inert example text; no evaluation. */
(()=>{
 const art=document.querySelector('.security-art'),hero=document.querySelector('.hero');if(!art||!hero)return;
 const button=art.querySelector('.motion-toggle'),replay=art.querySelector('.replay-motion'),motion=matchMedia('(prefers-reduced-motion:reduce)');
 const weak=navigator.hardwareConcurrency<=2||navigator.deviceMemory<=2||navigator.connection?.saveData;
 const kind=art.dataset.concept;if(kind==='flow'&&(!globalThis.MalGuardCodeDemo||!globalThis.MalGuardFlowGeometry||!globalThis.createMalGuardFlowView))return;
 let artVisible=false,heroVisible=false,paused=false,timer=0,last=0,elapsed=0,ticks=0,pendingUntil=null,selected='mixed';
 const typed=[...art.querySelectorAll(kind==='shield'?'.shield-volume text':'.core-code text')].map(node=>({node,source:node.textContent}));
 const status=art.querySelector('.demo-status'),flowView=kind==='flow'&&globalThis.createMalGuardFlowView?createMalGuardFlowView(art.querySelector('.flow-stage')):null;
 const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
 const animate=()=>artVisible&&!document.hidden&&!motion.matches&&!paused&&!weak&&(kind!=='flow'||flowView?.animated!==false);
 function finishReview(){
  if(!status)return;if(selected==='mixed'){art.dataset.verdict='mixed';status.textContent='Mixed examples · gray in, green / red out';pendingUntil=null;return;}const result=MalGuardCodeDemo.review(MalGuardCodeDemo.examples[selected]);
  art.dataset.verdict=result.verdict;
  status.textContent=result.flags.length?'Flagged example · '+result.flags.join(', '):'Example reviewed · no flagged pattern';
  pendingUntil=null;
 }
 function choose(name){
  selected=name;art.querySelectorAll('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.example===name)));
  flowView?.draw(elapsed+2800,selected);
  art.dataset.verdict='checking';status.textContent='Inspecting the selected example…';
  if(animate())pendingUntil=elapsed+500;else finishReview();
 }
 function render(){
  const phase=elapsed%9000;
  art.dataset.motionTicks=String(++ticks);
  if(kind==='flow'){
   flowView?.draw(elapsed+2800,selected);
   if(pendingUntil!==null&&elapsed>=pendingUntil)finishReview();
  }else{
   const next=phase<3600?'code':phase<4200?'transform':phase<7800?'brand':'reset';if(art.dataset.phase!==next)art.dataset.phase=next;
   const total=typed.reduce((n,t)=>n+t.source.length,0),count=Math.floor(Math.min(1,phase/2900)*total);let used=0;
   typed.forEach(t=>{setText(t.node,t.source.slice(0,Math.max(0,count-used)));used+=t.source.length;});
  }
 }
 function tick(){timer=0;if(!animate()){if(pendingUntil!==null)finishReview();return;}const now=performance.now();elapsed+=last?Math.min(now-last,250):0;last=now;render();timer=setTimeout(tick,kind==='flow'?42:70);}
 function sync(){
  clearTimeout(timer);timer=0;last=0;
  const allowed=!motion.matches&&!document.hidden&&!paused;if(replay)replay.textContent=motion.matches||weak?'Show logo / code':'Replay sequence';
  art.classList.toggle('motion-active',allowed&&artVisible&&!weak);
  hero.classList.toggle('hero-motion-active',allowed&&heroVisible);hero.dataset.motionPaused=String(paused);button.hidden=motion.matches||weak;
  if(animate())tick();else if(pendingUntil!==null)finishReview();
 }
 if(!('IntersectionObserver'in window))return;
 const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.target===art)artVisible=e.isIntersecting;else heroVisible=e.isIntersecting;}sync();});observer.observe(art);observer.observe(hero.querySelector('.hero-description'));
 button.addEventListener('click',()=>{paused=!paused;button.textContent=paused?'Resume motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));sync();});
 if(replay){replay.hidden=false;replay.addEventListener('click',()=>{elapsed=0;if(motion.matches||weak){art.dataset.phase=art.dataset.phase==='brand'?'code':'brand';typed.forEach(t=>t.node.textContent=t.source);}else{paused=false;button.textContent='Pause motion';button.setAttribute('aria-pressed','false');render();sync();}});}
 if(kind==='flow'){art.querySelector('.demo-controls').hidden=false;art.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.example)));choose('mixed');}
 art.querySelector('.flow-stage')?.addEventListener('flow-ready',sync);
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',()=>{if(motion.matches){typed.forEach(t=>t.node.textContent=t.source);art.dataset.phase='code';}sync();});sync();
})();
