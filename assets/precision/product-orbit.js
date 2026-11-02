/* Decorative product identities; optional 3D never blocks the initial page. */
(()=>{
 const host=document.querySelector('.brand-orbit');if(!host)return;
 const requested=new URLSearchParams(location.search).get('motion');
 const mode=['merge','orbit','engine'].includes(requested)?requested:'engine';host.dataset.mode=mode;
 const captions={merge:'Your tools. One MalGuard.',orbit:'Your tools. Connected by MalGuard.',engine:'Link. File. AI. Agent. Drag the engine to inspect.'};
 host.querySelector('figcaption').textContent=captions[mode];
 const button=host.querySelector('.orbit-control'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let engine=null,finished=false,loading=false,inView=false,started=false,nearView=false,moduleTask=null,idleTask=0,pageLoaded=document.readyState==='complete';
 host.classList.add('is-offscreen');
 const target=host.querySelector(mode==='engine'?'.engine3d-host':'.orbit-stage');
 function sync(){engine?.setPaused(reduce.matches||document.hidden||host.classList.contains('is-paused')||host.classList.contains('is-offscreen'));}
 function replay(){finished=false;host.getAnimations({subtree:true}).forEach(a=>a.cancel());host.classList.remove('is-paused');host.querySelectorAll('*').forEach(n=>{n.style.animation='none';});void host.offsetWidth;host.querySelectorAll('*').forEach(n=>{n.style.animation='';});button.textContent='Pause animation';button.setAttribute('aria-pressed','false');}
 function preloadEngine(){
  if(mode!=='engine'||reduce.matches||document.hidden||!pageLoaded||(!nearView&&!inView))return null;
  if(!moduleTask)moduleTask=import('/assets/precision/product-engine3d.js?v=20261102-baked-studio').catch(()=>{moduleTask=null;return null;});
  return moduleTask;
 }
 async function warmEngine(){
  if(mode!=='engine'||loading||document.hidden||!pageLoaded||!inView||reduce.matches||host.classList.contains('is-paused'))return;
  loading=true;
  try{const module=await preloadEngine();if(!module){loading=false;target.dataset.renderState='poster';return;}engine=await module.mountEngine3D(target);host.querySelector('figcaption').textContent=engine?captions.engine:'Link. File. AI. Agent.';sync();}
  catch{target.dataset.renderState='poster';host.querySelector('figcaption').textContent='Link. File. AI. Agent.';}
 }
 function scheduleEngine(){
  if(mode!=='engine'||engine||loading||document.hidden)return;
  if(reduce.matches){target.dataset.renderState='poster';host.querySelector('figcaption').textContent='Link. File. AI. Agent.';return;}
  if(!pageLoaded||idleTask||(!inView&&!nearView)||host.classList.contains('is-paused'))return;
  const work=()=>{idleTask=0;if(inView)warmEngine();else preloadEngine();};
  idleTask='requestIdleCallback'in window?requestIdleCallback(work,{timeout:1000}):setTimeout(work,0);
 }
 button.addEventListener('click',()=>{if(mode==='merge'&&finished){replay();return;}const paused=host.classList.toggle('is-paused');button.textContent=paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));scheduleEngine();sync();});
 host.querySelector('.orbit-path').addEventListener('animationend',e=>{if(mode==='merge'&&e.animationName==='reference-orbit-exit'){finished=true;button.textContent='Replay animation';button.setAttribute('aria-pressed','false');}});
 if('IntersectionObserver'in window){
  new IntersectionObserver(entries=>{const entry=entries[0];inView=entry.isIntersecting&&entry.intersectionRatio>=(started ? .15 : .65);if(inView){started=true;host.dataset.motionStarted='true';}host.classList.toggle('is-offscreen',!inView);scheduleEngine();sync();},{threshold:[0,.15,.65]}).observe(target);
  if(mode==='engine')new IntersectionObserver(entries=>{nearView=entries[0].isIntersecting;scheduleEngine();},{rootMargin:'320px 0px',threshold:0}).observe(target);
 }else{inView=true;host.classList.remove('is-offscreen');scheduleEngine();}
 window.addEventListener('load',()=>{pageLoaded=true;scheduleEngine();},{once:true});
 document.addEventListener('visibilitychange',()=>{host.classList.toggle('is-tab-hidden',document.hidden);scheduleEngine();sync();});
 reduce.addEventListener('change',()=>{scheduleEngine();sync();});
 host.dataset.orbitReady='true';
})();
