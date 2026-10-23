/* Trigger the lightweight logo sequence once, only when visible. */
(()=>{
  'use strict';
  const scenes=[...document.querySelectorAll('[data-ai-fusion]')];
  if(!scenes.length||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const activate=scene=>{scene.dataset.fusionActive='true'};
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
