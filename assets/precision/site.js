/* Public content is immediately available. Decorative motion never owns visibility. */
(()=>{
 const root=document.documentElement;
 root.classList.remove('type-system');
 function ready(){
  document.querySelectorAll('[data-type-state]').forEach(el=>el.dataset.typeState='complete');
  document.querySelectorAll('[data-reveal-state]').forEach(el=>el.dataset.revealState='complete');
  document.querySelectorAll('[data-count-state]').forEach(el=>el.dataset.countState='complete');
  root.dataset.precisionTypeReady='true';root.dataset.experienceReady='true';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();

/* Keep the small-screen menu usable without disturbing viewport typing. */
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const details=document.querySelector('.precision-nav-mobile[open]');if(details){details.open=false;details.querySelector('summary')?.focus();}});

/* Navigation must never wait for the decorative typewriter queue. */
document.addEventListener('pointerdown',e=>{const a=e.target.closest?.('a[href]');if(!a)return;const href=a.getAttribute('href');if(!href||href.startsWith('#')||a.target==='_blank'||e.button>0)return;document.documentElement.classList.add('mg-navigating');},{capture:true,passive:true});

/* Day/night theme: top-left toggle, hour auto, manual override in localStorage. */
(()=>{const s=document.createElement('script');s.src='/assets/precision/mg-theme.js?v=20261105-nora';s.defer=true;document.head.appendChild(s);})();
