/* Instant copy: no typewriter queue, glyph overlays, observers or timers.
   All editorial text is provided by HTML and remains visible on first paint. */
(() => {
 'use strict';
 const root=document.documentElement;
 root.classList.remove('type-system');
 root.dataset.precisionMotionOrder='instant';
 function ready(){
  root.classList.remove('type-system');
  // Retain readiness metadata for page integrity checks; do not wrap or
  // replace the original text nodes, including translated content.
  if(document.body?.classList.contains('mg-precision-shared'))root.dataset.experienceReady='true';
  for(const node of document.querySelectorAll('[data-type]')){
   node.classList.remove('typing');
   node.dataset.typeState='complete';
   node.querySelector(':scope > .type-ink')?.remove();
  }
  for(const node of document.querySelectorAll('[data-reveal]'))node.dataset.revealState='complete';
  for(const node of document.querySelectorAll('[data-count-group]'))node.dataset.countState='complete';
  const nav=document.getElementById('navbar');
  if(nav){
   nav.dataset.reveal='nav';
   nav.dataset.revealState='complete';
   nav.dataset.navMotion='complete';
  }
  root.dataset.precisionTypeReady='true';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
 else ready();
})();
// Keep keyboard navigation independent of all decorative motion.
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const details=document.querySelector('.precision-nav-mobile[open]');
 if(details){details.open=false;details.querySelector('summary')?.focus();}
});
// Preserve immediate navigation feedback without holding navigation for typing.
document.addEventListener('pointerdown',event=>{
 const a=event.target.closest?.('a[href]');
 if(!a)return;
 const href=a.getAttribute('href');
 if(!href||href.startsWith('#')||a.target==='_blank'||event.button>0)return;
 document.documentElement.classList.add('mg-navigating');
},{capture:true,passive:true});
