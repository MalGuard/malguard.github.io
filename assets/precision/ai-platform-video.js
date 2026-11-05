/* Platform cards: load/play at most one promo at a time. preload stays none; src attaches on demand. */
(()=>{
 const stages=[...document.querySelectorAll('.mg-device-stage')];
 if(!stages.length)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const saveData=!!(navigator.connection&&navigator.connection.saveData);
 const autoAllowed=()=>!reduce.matches&&!saveData;
 const items=stages.map(stage=>{
  const video=stage.querySelector('video');
  const source=video&&video.querySelector('source');
  const src=source?source.getAttribute('src'):null;
  if(source&&src){source.removeAttribute('src');video.removeAttribute('src');video.load();}
  return {stage,video,source,src,button:stage.querySelector('.mg-device-toggle'),visible:false,ratio:0,userPaused:false,userPlay:false,armed:false};
 });
 const render=item=>{if(!item.video||!item.button)return;const playing=!item.video.paused;item.button.dataset.state=playing?'playing':'paused';item.button.setAttribute('aria-label',(playing?'Pause':'Play')+' MalGuard AI promo video');item.stage.classList.toggle('is-active',playing||item.visible);};
 const arm=item=>{if(item.armed||!item.source||!item.src)return;item.source.setAttribute('src',item.src);item.video.load();item.armed=true;};
 const disarm=item=>{if(!item.armed||!item.source)return;item.video.pause();item.source.removeAttribute('src');item.video.removeAttribute('src');item.video.load();item.armed=false;};
 const play=item=>{arm(item);item.video.muted=true;const p=item.video.play();if(p&&p.catch)p.then(()=>{item.stage.dataset.blocked='false';},()=>{item.stage.dataset.blocked='true';render(item);});};
 const pickActive=()=>{
  const candidates=items.filter(i=>i.video&&i.button&&i.visible&&!i.userPaused&&(autoAllowed()||i.userPlay));
  if(!candidates.length)return null;
  candidates.sort((a,b)=>b.ratio-a.ratio);
  return candidates[0];
 };
 const syncAll=()=>{
  const active=pickActive();
  for(const item of items){
   if(!item.video||!item.button)continue;
   if(item===active){if(item.video.paused)play(item);} 
   else {if(!item.video.paused)item.video.pause(); if(item.armed&&!item.userPlay)disarm(item);}
   render(item);
  }
 };
 for(const item of items){
  if(!item.video||!item.button)continue;
  if(!autoAllowed())item.stage.dataset.blocked='true';
  item.video.addEventListener('play',()=>render(item));item.video.addEventListener('pause',()=>render(item));
  item.button.addEventListener('click',()=>{
   if(item.video.paused){item.userPaused=false;item.userPlay=true;item.stage.dataset.blocked='false';
     for(const other of items){if(other!==item){other.userPlay=false;if(!other.video.paused)other.video.pause();}}
     play(item);syncAll();
   }else{item.userPaused=true;item.video.pause();syncAll();}
  });
 }
 const ready=items.filter(item=>item.video&&item.button);
 if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{
   for(const entry of entries){
    const item=ready.find(x=>x.stage===entry.target);if(!item)continue;
    item.visible=entry.isIntersecting&&entry.intersectionRatio>=.45;
    item.ratio=entry.intersectionRatio||0;
   }
   syncAll();
  },{threshold:[0,.45,.8]});
  ready.forEach(item=>io.observe(item.stage));
 }
 document.addEventListener('visibilitychange',syncAll);
 reduce.addEventListener?.('change',()=>ready.forEach(item=>{if(!autoAllowed()&&!item.userPlay)item.stage.dataset.blocked='true';syncAll();}));
})();
