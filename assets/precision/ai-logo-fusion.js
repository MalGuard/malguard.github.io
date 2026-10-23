/* Reveal the MalGuard AI composition once it enters the viewport.
   If JavaScript, IntersectionObserver, or motion is unavailable, keep the final
   MalGuard brand mark visible instead of showing a blank artwork. */
(()=>{
  'use strict';
  const scenes=[...document.querySelectorAll('[data-ai-fusion]')];
  if(!scenes.length)return;
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if(motion?.matches)return;
  const activate=scene=>{scene.dataset.fusionActive='true'};
  scenes.forEach(scene=>{scene.dataset.fusionReady='true'});
  if(!('IntersectionObserver' in window)){scenes.forEach(activate);return}
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting||entry.intersectionRatio<.12)continue;
      activate(entry.target);
      observer.unobserve(entry.target);
    }
  },{threshold:[0,.12,.35]});
  scenes.forEach(scene=>observer.observe(scene));
})();
