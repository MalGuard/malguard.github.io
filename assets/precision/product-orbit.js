/* Preview variants share one lightweight decorative component. No product logic. */
(()=>{
 const host=document.querySelector('.brand-orbit');if(!host)return;
 const requested=new URLSearchParams(location.search).get('motion');
 const mode=['merge','orbit','engine'].includes(requested)?requested:'orbit';
 host.dataset.mode=mode;
 const captions={merge:'Your tools. One MalGuard.',orbit:'Your tools. Connected by MalGuard.',engine:'Link. File. AI. Agent. Working in rhythm.'};
 host.querySelector('figcaption').textContent=captions[mode];
 const button=host.querySelector('.orbit-control');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 function reset(){host.getAnimations({subtree:true}).forEach(a=>a.cancel());host.classList.remove('is-paused');host.dataset.replay=String(Number(host.dataset.replay||0)+1);host.querySelectorAll('*').forEach(n=>{n.style.animation='none';});void host.offsetWidth;host.querySelectorAll('*').forEach(n=>{n.style.animation='';});button.textContent='Pause animation';button.setAttribute('aria-pressed','false');}
 button.addEventListener('click',()=>{
  const animations=host.getAnimations({subtree:true});
  if(mode==='merge'&&animations.length&&animations.every(a=>a.playState==='finished')){reset();return;}
  const paused=host.classList.toggle('is-paused');button.textContent=paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));
 });
 host.querySelector('.orbit-path').addEventListener('animationend',e=>{if(mode==='merge'&&e.animationName==='products-converge'){button.textContent='Replay animation';button.setAttribute('aria-pressed','false');}});
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{host.classList.toggle('is-offscreen',!entries[0].isIntersecting)},{threshold:0}).observe(host);
 document.addEventListener('visibilitychange',()=>host.classList.toggle('is-tab-hidden',document.hidden));
 reduce.addEventListener('change',()=>{if(reduce.matches)host.classList.remove('is-paused');});
 host.dataset.orbitReady='true';
})();
