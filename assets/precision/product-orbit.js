/* Decorative product identities; the physical 3D engine is an optional lazy module. */
(()=>{
 const host=document.querySelector('.brand-orbit');if(!host)return;
 const requested=new URLSearchParams(location.search).get('motion');
 const mode=['merge','orbit','engine'].includes(requested)?requested:'orbit';host.dataset.mode=mode;
 const captions={merge:'Your tools. One MalGuard.',orbit:'Your tools. Connected by MalGuard.',engine:'Link. File. AI. Agent. Drag the engine to inspect.'};
 host.querySelector('figcaption').textContent=captions[mode];
 const button=host.querySelector('.orbit-control'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let engine=null,finished=false;
 function sync(){engine?.setPaused(reduce.matches||document.hidden||host.classList.contains('is-paused')||host.classList.contains('is-offscreen'));}
 function replay(){finished=false;host.getAnimations({subtree:true}).forEach(a=>a.cancel());host.classList.remove('is-paused');host.querySelectorAll('*').forEach(n=>{n.style.animation='none';});void host.offsetWidth;host.querySelectorAll('*').forEach(n=>{n.style.animation='';});button.textContent='Pause animation';button.setAttribute('aria-pressed','false');}
 button.addEventListener('click',()=>{if(mode==='merge'&&finished){replay();return;}const paused=host.classList.toggle('is-paused');button.textContent=paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));sync();});
 host.querySelector('.orbit-path').addEventListener('animationend',e=>{if(mode==='merge'&&e.animationName==='reference-orbit-exit'){finished=true;button.textContent='Replay animation';button.setAttribute('aria-pressed','false');}});
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{host.classList.toggle('is-offscreen',!entries[0].isIntersecting);sync();},{threshold:0}).observe(host);
 document.addEventListener('visibilitychange',()=>{host.classList.toggle('is-tab-hidden',document.hidden);sync();});
 reduce.addEventListener('change',()=>{if(reduce.matches)host.classList.remove('is-paused');sync();});
 host.dataset.orbitReady='true';
 if(mode==='engine')requestAnimationFrame(()=>{
  import('/assets/precision/product-engine3d.js?v=20261102').then(async module=>{engine=await module.mountEngine3D(host.querySelector('.engine3d-host'));if(!engine)host.querySelector('figcaption').textContent='Link. File. AI. Agent.';sync();}).catch(()=>{host.querySelector('.engine3d-host').dataset.renderState='poster';});
 });
})();
