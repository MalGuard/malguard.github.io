/* Platform cards: start the muted promo when a device scrolls into view, pause when it leaves.
   Reduced motion, Save-Data and a user pause all keep the video still until the user presses play. */
(()=>{
 const stages=[...document.querySelectorAll('.mg-device-stage')];
 if(!stages.length)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const saveData=!!(navigator.connection&&navigator.connection.saveData);
 const autoAllowed=()=>!reduce.matches&&!saveData;
 const items=stages.map(stage=>({stage,video:stage.querySelector('video'),button:stage.querySelector('.mg-device-toggle'),visible:false,userPaused:false,userPlay:false}));
 const render=item=>{const playing=!item.video.paused;item.button.dataset.state=playing?'playing':'paused';item.button.setAttribute('aria-label',(playing?'Pause':'Play')+' MalGuard AI promo video');item.stage.classList.toggle('is-active',playing||item.visible);};
 const play=item=>{item.video.muted=true;const p=item.video.play();if(p&&p.catch)p.then(()=>{item.stage.dataset.blocked='false';},()=>{item.stage.dataset.blocked='true';render(item);});};
 const sync=item=>{const wants=item.visible&&!document.hidden&&!item.userPaused&&(autoAllowed()||item.userPlay);if(wants&&item.video.paused)play(item);else if(!wants&&!item.video.paused)item.video.pause();render(item);};
 for(const item of items){
  if(!item.video||!item.button)continue;
  if(!autoAllowed())item.stage.dataset.blocked='true';
  item.video.addEventListener('play',()=>render(item));item.video.addEventListener('pause',()=>render(item));
  item.button.addEventListener('click',()=>{if(item.video.paused){item.userPaused=false;item.userPlay=true;item.stage.dataset.blocked='false';play(item);}else{item.userPaused=true;item.video.pause();}});
 }
 const ready=items.filter(item=>item.video&&item.button);
 if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{for(const entry of entries){const item=ready.find(x=>x.stage===entry.target);if(!item)continue;item.visible=entry.isIntersecting&&entry.intersectionRatio>=.45;sync(item);}},{threshold:[0,.45,.8]});
  ready.forEach(item=>io.observe(item.stage));
 }
 document.addEventListener('visibilitychange',()=>ready.forEach(sync));
 reduce.addEventListener?.('change',()=>ready.forEach(item=>{if(!autoAllowed()&&!item.userPlay)item.stage.dataset.blocked='true';sync(item);}));
})();
