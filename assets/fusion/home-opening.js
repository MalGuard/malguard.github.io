/* A short, authored MalGuard brand film. Presentation only: no camera toy,
   no file reading, no scroll interception, no extra content route. */
(() => {
  'use strict';
  const root=document.getElementById('home-opening');if(!root)return;
  const host=document.getElementById('home-scene'),controls=document.getElementById('home-opening-controls');
  const skip=document.getElementById('home-opening-skip'),replay=document.getElementById('home-opening-replay');
  const copy=document.querySelector('.scene[data-scene="0"] .t');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const duration=7700,clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const smooth=(a,b,n)=>{const v=clamp((n-a)/(b-a));return v*v*v*(v*(v*6-15)+10);};
  const weak=()=>innerWidth<=600||innerHeight<500||(navigator.deviceMemory||8)<=2||(navigator.hardwareConcurrency||8)<4||navigator.connection?.saveData;
  let elapsed=0,complete=false,raf=0,last=0,renderer=null,loading=false,disposed=false,generation=0;
  let mode='css',failure='',lastMetrics=null,scriptPromise=null,frameCount=0,caption=-1,frameDelta=16,slowFrames=0,qualityFallback='',performanceLimited=false;
  const cleanups=[];
  function listen(el,type,fn,opt){el.addEventListener(type,fn,opt);cleanups.push(()=>el.removeEventListener(type,fn,opt));}
  // Preserve the original entrance path and reveal clock, then accelerate from rest. One shared clock
  // keeps the model, fallback, particles and copy in the same short sequence.
  const spinAt=3400,releaseAt=5400,gatherAt=6150,formedAt=7450;
  function state(){
    const compact=innerWidth<=900,arrival=smooth(160,1900,elapsed);
    const spin=clamp((elapsed-spinAt)/(releaseAt-spinAt)),charge=spin*spin;
    // Integrated positive acceleration: angle and velocity both start at zero,
    // and speed keeps increasing until release, without a second speed jump.
    const quantumTurn=Math.PI*2*3.05*spin*spin*spin;
    const quantumEnergy=(.2*smooth(280,1550,elapsed)+.8*charge)*(1-smooth(releaseAt,releaseAt+250,elapsed));
    const burst=smooth(releaseAt-90,releaseAt+90,elapsed)*(1-smooth(releaseAt+190,releaseAt+650,elapsed));
    return{elapsed,duration,complete,frameDelta,spinAt,releaseAt,gatherAt,formedAt,
      particleProgress:complete?1:smooth(gatherAt,duration,elapsed),
      open:smooth(800,3400,elapsed),logo:smooth(1700,3300,elapsed),scan:clamp((elapsed-2100)/1800),
      beam:smooth(2000,2300,elapsed)*(1-smooth(3600,3950,elapsed)),burst,
      burstScale:.12+1.7*smooth(releaseAt-90,releaseAt+620,elapsed),
      handoff:smooth(releaseAt+100,releaseAt+750,elapsed),compact,
      portalX:(compact?.88:.9)+((compact?.5:.67)-(compact?.88:.9))*arrival,
      portalY:(compact?.88:.86)+((compact?.34:.48)-(compact?.88:.86))*arrival,
      quantumTurn,quantumEnergy,charge,
      fragments:smooth(releaseAt-30,releaseAt+290,elapsed)};
  }
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
    root.style.setProperty('--opening-burst',s.burst.toFixed(4));root.style.setProperty('--opening-burst-scale',s.burstScale.toFixed(4));
    root.style.setProperty('--opening-x',`${(s.portalX*100).toFixed(3)}%`);root.style.setProperty('--opening-y',`${(s.portalY*100).toFixed(3)}%`);
    root.style.setProperty('--opening-spin',`${(s.quantumTurn*180/Math.PI).toFixed(2)}deg`);root.style.setProperty('--opening-energy',s.quantumEnergy.toFixed(4));root.style.setProperty('--opening-fragments',s.fragments.toFixed(4));
    root.style.setProperty('--opening-caption',(smooth(1400,2400,elapsed)*(1-smooth(releaseAt-100,releaseAt+200,elapsed))).toFixed(4));
    const beat=elapsed<1700?0:elapsed<3500?1:2;
    if(beat!==caption){caption=beat;root.querySelector('.opening-ident span+span').textContent=['Establish the boundary','Bring the evidence into view','Scan smart. Play safe.'][beat];}
    controls.querySelector('.opening-counter').textContent=`0${Math.min(3,beat+1)} / 03`;
    if(renderer)try{renderer.draw(s);}catch(e){failure='Rendering unavailable';mode='css';releaseRenderer();}
    frameCount++;root.dataset.phase=['boundary','evidence','reveal'][beat];root.dataset.renderer=mode;
  }
  function frame(){
    raf=0;if(disposed||complete||document.hidden)return;
    // Use elapsed wall time, rather than slowing the film on a busy GPU.
    // Visibility changes reset this clock, so a hidden tab never skips ahead.
    const now=performance.now();
    frameDelta=last?Math.max(0,now-last):16;last=now;elapsed=Math.min(duration,elapsed+frameDelta);
    if(renderer){slowFrames=frameDelta>120?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>=2){performanceLimited=true;qualityFallback='frame-budget';mode='css';root.classList.add('fallback-immediate');releaseRenderer();}}
    if(reduced.matches||document.body.classList.contains('motion-paused')){finish('motion-preference');return;}
    paint();if(elapsed>=duration)finish();else raf=requestAnimationFrame(frame);
  }
  function wake(){if(!disposed&&!complete&&!document.hidden&&!raf){last=performance.now();raf=requestAnimationFrame(frame);}}
  function loadFactory(){
    if(window.createMalGuardHomeScene)return Promise.resolve();
    if(scriptPromise)return scriptPromise;
    scriptPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script'),embedded=document.getElementById('home-scene-embedded');
      const timeout=setTimeout(()=>{script.remove();reject(Error('Opening unavailable'));},3500);
      script.onerror=()=>{clearTimeout(timeout);script.remove();reject(Error('Opening unavailable'));};
      if(embedded){try{script.textContent=atob(embedded.textContent.trim());document.head.append(script);clearTimeout(timeout);resolve();}catch(e){clearTimeout(timeout);reject(e);}}
      else{script.src='/assets/fusion/home-opening-scene.js?v=20261011-original-entry-clock';script.onload=()=>{clearTimeout(timeout);resolve();};document.head.append(script);}
    }).catch(e=>{scriptPromise=null;throw e;});return scriptPromise;
  }
  async function enhance(){
    if(weak()||performanceLimited||reduced.matches||complete||disposed||renderer||loading)return;
    loading=true;const token=generation;
    try{
      await loadFactory();if(token!==generation||complete||disposed||weak())return;
      const made=await window.createMalGuardHomeScene(host,{lite:innerWidth<=1100||matchMedia('(pointer:coarse)').matches,onContextLost:()=>{failure='WebGL context lost';performanceLimited=true;mode='css';root.classList.add('fallback-immediate');releaseRenderer();paint();}});
      if(token!==generation||complete||disposed||elapsed>releaseAt+300){made.dispose();return;}
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
