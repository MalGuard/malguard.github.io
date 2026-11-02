/* Decorative product identities; the physical 3D engine is an optional lazy module. */
(()=>{
 const host=document.querySelector('.brand-orbit');if(!host)return;
 const requested=new URLSearchParams(location.search).get('motion');
 const mode=['merge','orbit','engine'].includes(requested)?requested:'orbit';host.dataset.mode=mode;
 const captions={merge:'Your tools. One MalGuard.',orbit:'Your tools. Connected by MalGuard.',engine:'Link. File. AI. Agent. Drag the engine to inspect.'};
 host.querySelector('figcaption').textContent=captions[mode];
 const button=host.querySelector('.orbit-control'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let engine=null,finished=false,loading=false,inView=false,started=false;
 host.classList.add('is-offscreen');
 const target=host.querySelector(mode==='engine'?'.engine3d-host':'.orbit-stage');
 function sync(){engine?.setPaused(reduce.matches||document.hidden||host.classList.contains('is-paused')||host.classList.contains('is-offscreen'));}
 function replay(){finished=false;host.getAnimations({subtree:true}).forEach(a=>a.cancel());host.classList.remove('is-paused');host.querySelectorAll('*').forEach(n=>{n.style.animation='none';});void host.offsetWidth;host.querySelectorAll('*').forEach(n=>{n.style.animation='';});button.textContent='Pause animation';button.setAttribute('aria-pressed','false');}
 button.addEventListener('click',()=>{if(mode==='merge'&&finished){replay();return;}const paused=host.classList.toggle('is-paused');button.textContent=paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));sync();});
 host.querySelector('.orbit-path').addEventListener('animationend',e=>{if(mode==='merge'&&e.animationName==='reference-orbit-exit'){finished=true;button.textContent='Replay animation';button.setAttribute('aria-pressed','false');}});
 async function warmEngine(){
  if(mode!=='engine'||loading||document.hidden)return;loading=true;
  try{const module=await import('/assets/precision/product-engine3d.js?v=20261102-combustion-view');engine=await module.mountEngine3D(target);if(!engine)host.querySelector('figcaption').textContent='Link. File. AI. Agent.';sync();}
  catch{target.dataset.renderState='poster';}
 }
 if('IntersectionObserver'in window){
  new IntersectionObserver(entries=>{const entry=entries[0];inView=entry.isIntersecting&&entry.intersectionRatio>=(started ? .15 : .65);if(inView){started=true;host.dataset.motionStarted='true';warmEngine();}host.classList.toggle('is-offscreen',!inView);sync();},{threshold:[0,.15,.65]}).observe(target);
  if(mode==='engine')new IntersectionObserver(entries=>{if(entries[0].isIntersecting)warmEngine();},{rootMargin:'320px 0px',threshold:0}).observe(target);
 }else{inView=true;host.classList.remove('is-offscreen');warmEngine();}
 document.addEventListener('visibilitychange',()=>{host.classList.toggle('is-tab-hidden',document.hidden);if(!document.hidden&&inView)warmEngine();sync();});
 reduce.addEventListener('change',sync);
 host.dataset.orbitReady='true';
})();
