/* Reveal the MalGuard AI composition once it enters the viewport.
   If JavaScript, IntersectionObserver, or motion is unavailable, keep the final
   MalGuard brand mark visible instead of showing a blank artwork. */
(()=>{
  'use strict';
  const scenes=[...document.querySelectorAll('[data-ai-fusion]')];
  if(!scenes.length)return;
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if(motion?.matches)return;
  let observer,revealObserver;
  let stopped=false;
  const visible=new Set(),pending=new Set(scenes);
  const stop=()=>{
    if(!motion?.matches)return;
    stopped=true;
    observer?.disconnect();
    revealObserver?.disconnect();
    scenes.forEach(scene=>{
      delete scene.dataset.fusionReady;
      delete scene.dataset.fusionActive;
    });
  };
  // A motion-preference change settles every scene permanently. Re-enabling
  // motion must not hide the final mark or replay this one-shot composition.
  motion?.addEventListener('change',stop);
  const activate=scene=>{
    if(stopped||!visible.has(scene)||!pending.has(scene))return;
    const card=scene.closest('.product[data-reveal]');
    if(card&&document.documentElement.classList.contains('type-system')&&
      !['active','paused','complete'].includes(card.dataset.revealState))return;
    scene.dataset.fusionActive='true';
    pending.delete(scene);
    observer?.unobserve(scene);
    if(!pending.size)revealObserver?.disconnect();
  };
  scenes.forEach(scene=>{scene.dataset.fusionReady='true'});
  if(!('IntersectionObserver' in window)){scenes.forEach(scene=>{visible.add(scene);activate(scene)});return}
  // IntersectionObserver sees transparent cards too. Wait for the existing
  // typewriter reveal before spending the scene's single playback.
  revealObserver=new MutationObserver(()=>pending.forEach(activate));
  revealObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  scenes.forEach(scene=>{
    const card=scene.closest('.product[data-reveal]');
    if(card)revealObserver.observe(card,{attributes:true,attributeFilter:['data-reveal-state']});
  });
  observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting||entry.intersectionRatio<.12){visible.delete(entry.target);continue}
      visible.add(entry.target);
      activate(entry.target);
    }
  },{threshold:[0,.12,.35]});
  scenes.forEach(scene=>observer.observe(scene));
})();
