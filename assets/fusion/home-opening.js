/* A short, authored MalGuard brand film. Presentation only: no camera toy,
   no file reading, no scroll interception, no extra content route. */
(() => {
  'use strict';
  const root=document.getElementById('home-opening');if(!root)return;
  const host=document.getElementById('home-scene'),controls=document.getElementById('home-opening-controls');
  const skip=document.getElementById('home-opening-skip'),replay=document.getElementById('home-opening-replay');
  const copy=document.querySelector('.scene[data-scene="0"] .t');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const duration=6400,clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=(a,b,n)=>{const v=clamp((n-a)/(b-a));return v*v*v*(v*(v*6-15)+10);};
  const weak=()=>innerWidth<=600||innerHeight<500||(navigator.deviceMemory||8)<=2||(navigator.hardwareConcurrency||8)<4||navigator.connection?.saveData;
  let elapsed=0,complete=false,raf=0,last=0,renderer=null,loading=false,disposed=false,generation=0;
  let mode='css',failure='',lastMetrics=null,scriptPromise=null,frameCount=0,caption=-1,frameDelta=16,slowFrames=0,qualityFallback='',performanceLimited=false;
  const cleanups=[];
  function listen(el,type,fn,opt){el.addEventListener(type,fn,opt);cleanups.push(()=>el.removeEventListener(type,fn,opt));}
  function state(){return{elapsed,duration,complete,frameDelta,particleProgress:complete?1:clamp((elapsed-3200)/3200),open:smooth(800,3400,elapsed),logo:smooth(1700,3300,elapsed),scan:clamp((elapsed-2100)/1800),beam:smooth(2000,2300,elapsed)*(1-smooth(3600,3950,elapsed)),handoff:smooth(4300,6250,elapsed),compact:innerWidth<=900};}
  function releaseRenderer(){if(renderer){lastMetrics=renderer.metrics();renderer.dispose();renderer=null;}root.classList.remove('webgl');}
  function syncControls(){controls.hidden=scrollY>innerHeight*.65||reduced.matches;skip.hidden=complete;replay.hidden=!complete;controls.querySelector('.opening-counter').hidden=complete;}
  function finish(reason='complete',focus=false){
    if(disposed)return;elapsed=duration;complete=true;generation++;loading=false;
    cancelAnimationFrame(raf);raf=0;last=0;root.hidden=true;releaseRenderer();
    document.body.classList.remove('home-opening-active');
    document.body.dataset.intro='ready';copy.inert=false;copy.closest('.scene').classList.add('in');
    root.dataset.finished=reason;syncControls();
    if(focus){const h=copy.querySelector('h1');h.tabIndex=-1;h.focus({preventScroll:true});}
    window.dispatchEvent(new CustomEvent('mg:opening-ready'));
  }
  function paint(){
    const s=state(),alpha=1-s.handoff;
    root.style.setProperty('--opening-alpha',alpha.toFixed(4));
    root.style.setProperty('--opening-open',s.open.toFixed(4));root.style.setProperty('--opening-logo',s.logo.toFixed(4));
    root.style.setProperty('--opening-scan',s.scan.toFixed(4));root.style.setProperty('--opening-beam',s.beam.toFixed(4));
    root.style.setProperty('--opening-caption',(smooth(1400,2400,elapsed)*(1-smooth(4400,5200,elapsed))).toFixed(4));
    const beat=elapsed<1700?0:elapsed<3500?1:2;
    if(beat!==caption){caption=beat;root.querySelector('.opening-ident span+span').textContent=['Establish the boundary','Bring the evidence into view','Scan smart. Play safe.'][beat];}
    controls.querySelector('.opening-counter').textContent=`0${Math.min(3,beat+1)} / 03`;
    if(renderer)try{renderer.draw(s);}catch(e){failure='Rendering unavailable';mode='css';releaseRenderer();}
    frameCount++;root.dataset.phase=['boundary','evidence','reveal'][beat];root.dataset.renderer=mode;
  }
  function frame(ts){
    raf=0;if(disposed||complete||document.hidden)return;
    // Use elapsed wall time, rather than slowing the film on a busy GPU.
    // Visibility changes reset this clock, so a hidden tab never skips ahead.
    frameDelta=last?Math.max(0,ts-last):16;last=ts;elapsed=Math.min(duration,elapsed+frameDelta);
    if(renderer){slowFrames=frameDelta>120?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=2){performanceLimited=true;qualityFallback='frame-budget';mode='css';root.classList.add('fallback-immediate');releaseRenderer();}}
    if(reduced.matches||document.body.classList.contains('motion-paused')){finish('motion-preference');return;}
    paint();if(elapsed>=duration)finish();else raf=requestAnimationFrame(frame);
  }
  function wake(){if(!disposed&&!complete&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(frame);}}
  function loadFactory(){
    if(window.createMalGuardHomeScene)return Promise.resolve();
    if(scriptPromise)return scriptPromise;
    scriptPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script'),embedded=document.getElementById('home-scene-embedded');
      const timeout=setTimeout(()=>{script.remove();reject(Error('Opening unavailable'));},3500);
      script.onerror=()=>{clearTimeout(timeout);script.remove();reject(Error('Opening unavailable'));};
      if(embedded){try{script.textContent=atob(embedded.textContent.trim());document.head.append(script);clearTimeout(timeout);resolve();}catch(e){clearTimeout(timeout);reject(e);}}
      else{script.src='/assets/fusion/home-opening-scene.js?v=20261009';script.onload=()=>{clearTimeout(timeout);resolve();};document.head.append(script);}
    }).catch(e=>{scriptPromise=null;throw e;});return scriptPromise;
  }
  async function enhance(){
    if(weak()||performanceLimited||reduced.matches||complete||disposed||renderer||loading)return;
    loading=true;const token=generation;
    try{
      await loadFactory();if(token!==generation||complete||disposed||weak())return;
      const made=await window.createMalGuardHomeScene(host,{lite:innerWidth<=1100||matchMedia('(pointer:coarse)').matches,onContextLost:()=>{failure='WebGL context lost';performanceLimited=true;mode='css';root.classList.add('fallback-immediate');releaseRenderer();paint();}});
      if(token!==generation||complete||disposed||elapsed>5200){made.dispose();return;}
      renderer=made;renderer.draw(state());mode='webgl';root.classList.add('webgl');
    }catch(e){failure='Three-dimensional opening unavailable';performanceLimited=true;mode='css';}
    finally{if(token===generation)loading=false;}
  }
  function start(){
    if(disposed)return;generation++;elapsed=0;complete=false;last=0;caption=-1;mode='css';failure='';qualityFallback=performanceLimited?'frame-budget':'';slowFrames=0;root.classList.remove('fallback-immediate');root.hidden=false;
    document.body.dataset.intro='assembling';document.body.classList.add('home-opening-active');
    copy.inert=true;copy.closest('.scene').classList.remove('in');
    root.removeAttribute('data-finished');syncControls();paint();
    if(reduced.matches||document.body.classList.contains('motion-paused')||scrollY>64||innerHeight<500){finish('direct-entry');return;}
    enhance();wake();
  }
  listen(skip,'click',()=>finish('skip',true));
  listen(replay,'click',()=>{scrollTo({top:0,behavior:'instant'});window.MalGuardParticles?.restartIntro();start();skip.focus({preventScroll:true});});
  listen(window,'scroll',()=>{if(!complete&&scrollY>64)finish('scroll');syncControls();},{passive:true});
  listen(window,'resize',()=>{if(renderer){if(weak()){mode='css';releaseRenderer();}else renderer.resize();}if(!complete)paint();syncControls();},{passive:true});
  listen(document,'keydown',e=>{if(e.key==='Escape'&&!complete){e.preventDefault();finish('escape',true);}});
  listen(document.querySelector('.skip-link'),'click',()=>finish('skip-link'));
  listen(document,'visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden)wake();});
  listen(window,'mg:motion',e=>{if(e.detail.paused&&!complete)finish('pause');});
  listen(reduced,'change',()=>{if(reduced.matches)finish('reduced-motion');syncControls();});
  function dispose(){if(disposed)return;disposed=true;generation++;cancelAnimationFrame(raf);raf=0;releaseRenderer();cleanups.splice(0).forEach(fn=>fn());}
  listen(window,'pagehide',e=>{if(!e.persisted)dispose();else{cancelAnimationFrame(raf);raf=0;last=0;}});
  listen(window,'pageshow',()=>wake());
  window.MalGuardOpening={state,snapshot:()=>({...state(),renderer:mode,loading,failure,qualityFallback,frames:frameCount,raf:Boolean(raf),gpuReleased:!renderer,metrics:renderer?.metrics()||lastMetrics,finished:root.dataset.finished||null}),finish};
  start();
})();
