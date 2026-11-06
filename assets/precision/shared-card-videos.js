/* Shared product video controller. Prepares nearby videos early; plays only when visible. */
(()=>{
'use strict';
const cards=[...document.querySelectorAll('.mg-card-video')].map(video=>({
 video,card:video.closest('.mg-home-product,.product'),button:video.closest('.mg-home-product-art,.product-art')?.querySelector('.mg-card-vid-btn'),
 visible:false,ready:false,manualPause:false,manualPlay:false,timer:0
})).filter(x=>x.card);
if(!cards.length)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const saveData=()=>!!navigator.connection?.saveData;
const canAuto=()=>!reduced.matches&&!saveData()&&!document.hidden;

function prepare(x){if(x.ready)return;x.ready=true;x.video.preload=saveData()?'metadata':'auto';x.video.load();}
function update(x){if(!x.button)return;const playing=!x.video.paused;x.button.textContent=playing?'❚❚':'▶';x.button.setAttribute('aria-label',playing?'Pause promo video':'Play promo video');}
function stop(x){clearTimeout(x.timer);x.timer=0;x.video.pause();update(x);}
function play(x,manual=false){
 if(document.hidden||!x.visible)return;
 if(!manual&&(!canAuto()||x.manualPause))return;
 prepare(x);x.video.muted=!manual;
 const p=x.video.play();
 if(p?.catch)p.catch(()=>{x.video.muted=true;if(manual)x.video.play().catch(()=>{});});
}
function sync(x){
 clearTimeout(x.timer);
 if(!x.visible||document.hidden){stop(x);return;}
 if(x.manualPause)return;
 if(!canAuto()&&!x.manualPlay)return;
 if(!x.video.paused)return;
 // Play immediately when the card becomes visible; preload happened earlier.
 play(x);
}
cards.forEach(x=>{
 x.video.preload=saveData()?'metadata':'auto';x.video.muted=true;x.video.playsInline=true;
 x.video.addEventListener('play',()=>update(x));x.video.addEventListener('pause',()=>update(x));
 x.button?.addEventListener('click',()=>{
  if(!x.video.paused){x.manualPause=true;x.manualPlay=false;stop(x);}
  else{x.manualPause=false;x.manualPlay=true;cards.forEach(other=>{if(other!==x)stop(other)});play(x,true);}
 });
 update(x);
});
// Begin buffering all product promos at page initialization, not when scrolled near.
// Browsers retain control of how many bytes are fetched; Save-Data gets metadata only.
cards.forEach(prepare);
if('IntersectionObserver'in window){
 const visible=new IntersectionObserver(entries=>entries.forEach(e=>{
  const x=cards.find(i=>i.card===e.target);if(!x)return;
  x.visible=e.isIntersecting&&e.intersectionRatio>=0.35;
  sync(x);
 }),{threshold:[0,.35,.6]});
 cards.forEach(x=>visible.observe(x.card));
}else{cards.forEach(x=>{x.visible=true;sync(x);});}
document.addEventListener('visibilitychange',()=>cards.forEach(sync));
reduced.addEventListener?.('change',()=>cards.forEach(sync));
})();
