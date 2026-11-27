/* GTA Guard: authored cinematic opening + a fictional HTML evidence walkthrough.
   This module never accepts a File, invokes a scanner, or accesses file bytes. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
(() => {
  'use strict';
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ignoreMobileResize:true,syncInterval:0});
  const $ = id => document.getElementById(id);
  const art = $('gta-art'), hero = $('overview'), copy = hero.querySelector('.hero-copy'), stageHost=$('gta-stage');
  const app=$('scanner-app'), appSlot=document.createElement('div');
  appSlot.className='app-slot';app.parentNode.insertBefore(appSlot,app);appSlot.append(app);
  const chapters=[...document.querySelectorAll('[data-chapter]')], rail=$('journey-rail');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [], stages = [...document.querySelectorAll('.analysis-stages li')];
  const duration = 5800, scanDuration = 8800;
  const samples = [
    { name: 'NightDrive.asi', verdict: 'Suspicious', color: '#e9c795', format: 'ASI native plug-in (fictional)', finding: 'Unexpected embedded loader (invented)', coverage: 'Completed demo checks; attribution remains uncertain.', detail: 'This invented mod contains an unexpected embedded loader. The scripted indicators call for closer inspection.', trace: ['Identity established: fictional ASI plug-in.', 'Structure inspected: unexpected embedded loader.', 'Indicators correlated: suspicious pattern in this scenario.', 'Decision: Suspicious. Attribution remains uncertain.'] },
    { name: 'vehicle_pack.dll', verdict: 'Inconclusive', color: '#e9c795', format: 'DLL native library (fictional)', finding: 'Encrypted member; required evidence unavailable (invented)', coverage: 'Incomplete. Inconclusive must never be interpreted as Safe.', detail: 'An invented encrypted member prevents complete analysis. Required evidence is missing; this is never a clean result.', trace: ['Identity established: fictional DLL library.', 'Structure inspected: an encrypted member is present.', 'Coverage checked: required evidence is unavailable.', 'Decision: Inconclusive. Missing evidence never means safe.'] },
    { name: 'texture_pack.rpf', verdict: 'No scripted indicators', color: '#bdd9ed', format: 'RPF asset package (fictional)', finding: 'Completed demo checks found no scripted indicators', coverage: 'Completed within this invented scenario only.', detail: 'Completed demo checks found no scripted indicators. This invented result makes no claim about any real file. A clean result is never a guarantee.', trace: ['Identity established: fictional RPF package.', 'Structure inspected: supported demo records examined.', 'Coverage checked: the scripted checks are complete.', 'Decision: No scripted indicators. This is not a safety guarantee.'] },
    { name: 'loader_x.asi', verdict: 'Malicious', color: '#efaab8', format: 'ASI native plug-in (fictional)', finding: 'Credential-access and loader pattern (invented)', coverage: 'Completed demo checks; multiple invented indicators agree.', detail: 'The fictional evidence combines credential-access and loader patterns. This scenario is scripted to produce a Malicious result.', trace: ['Identity established: fictional ASI plug-in.', 'Structure inspected: credential-access and loader patterns.', 'Indicators correlated: multiple invented harm patterns agree.', 'Decision: Malicious, within this scripted scenario.'] }
  ];
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  let intro = 0, selected = 1, scan = 0, scanning = false, completed = false;
  let paused = false, heroVisible = true, appVisible = false, disposed = false;
  let renderer = null, rendererLoading = false, renderFailed = false;
  let raf = 0, previous = 0, pointer = { x: 0, y: 0 }, currentPointer = { x: 0, y: 0 };
  let scrollPose = 0, currentScrollPose = 0, rendered = '', paint = '', sceneLoadedAt = 0;
  let scrollTrigger=null,enhanced=false,activeChapter=-1,portalActive=false,demoFocusPending=false,demoFocusTarget=0;
  let lastReduced=reduced.matches;
  let lastViewportWidth=innerWidth,lastStageHeight=0,lastStoryHeight=hero.offsetHeight;
  let appAbsoluteTop=0,lastStableScrollY=scrollY,motionTransition=null;
  const values={cameraX:-5.1,cameraY:3.8,cameraZ:12.2,arrival:0,door:0,shift:0,scan:0,scanOpacity:0,logo:0,light:0,depth:0,explode:0,turn:0,fileFlight:0,connections:0,evidenceFlow:0,report:0,dive:0,city:1,introBeat:0};
  const introTimeline=gsap.timeline({paused:true})
    .to(values,{light:.65,duration:1.2,ease:'power2.out'},0)
    .to(values,{cameraX:3.2,cameraY:1.8,cameraZ:11.5,duration:3.8,ease:'power2.inOut'},0)
    .to(values,{door:1,duration:1.5,ease:'power3.inOut'},.75)
    .to(values,{arrival:1,duration:2.3,ease:'power3.inOut'},1)
    .to(values,{scanOpacity:1,duration:.3},2.3)
    .to(values,{scan:1,duration:1.7,ease:'none'},2.5)
    .to(values,{logo:1,duration:.9,ease:'power2.out'},3.5)
    .to(values,{scanOpacity:0,duration:.45},4.1)
    .to(values,{shift:1,city:.7,cameraX:-4.6,cameraY:1.7,cameraZ:11.8,duration:1.45,ease:'power3.inOut'},4.15)
    .to(values,{introBeat:1,duration:5.8,ease:'none'},0);
  const journeyValues={cameraX:-4.6,cameraY:1.7,cameraZ:11.8,arrival:1,door:1,shift:1,scan:0,scanOpacity:0,logo:1,light:.65,depth:0,explode:0,turn:0,fileFlight:0,connections:0,evidenceFlow:0,report:0,dive:0,city:.7,journeyBeat:0};
  const journeyTimeline=gsap.timeline({paused:true})
    .to(journeyValues,{cameraX:4.2,cameraY:1.4,cameraZ:11.6,fileFlight:.35,depth:.4,turn:-.07,light:.85,duration:.12,ease:'power2.inOut'},.14)
    .to(journeyValues,{explode:1,depth:1,cameraX:-4.8,cameraY:2.5,cameraZ:12.8,turn:.04,light:1,duration:.13,ease:'power2.inOut'},.32)
    .set(journeyValues,{scan:0},.36)
    .to(journeyValues,{scanOpacity:1,duration:.03},.36)
    .to(journeyValues,{scan:1,duration:.15,ease:'none'},.38)
    .to(journeyValues,{scanOpacity:0,duration:.035},.535)
    .to(journeyValues,{explode:.12,connections:1,cameraX:4.2,cameraY:1.2,cameraZ:11.8,turn:-.02,fileFlight:0,duration:.12,ease:'power2.inOut'},.55)
    .to(journeyValues,{evidenceFlow:1,duration:.14,ease:'none'},.575)
    .to(journeyValues,{connections:0,report:1,explode:0,cameraX:-2.1,cameraY:.8,cameraZ:11.5,turn:0,duration:.11,ease:'power2.inOut'},.72)
    .to(journeyValues,{dive:1,cameraX:0,cameraY:0,cameraZ:5.8,shift:0,depth:0,duration:.15,ease:'power2.inOut'},.85)
    .to(journeyValues,{journeyBeat:1,duration:1,ease:'none'},0);
  const still = () => reduced.matches || paused;
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); cleanups.push(() => target.removeEventListener(type, handler, options)); };
  function scenario() { return samples[selected]; }
  function filename() { return $('sample-name').value.trim() || scenario().name; }
  function syncCopy(ready) {
    document.body.dataset.intro = ready ? 'ready' : 'assembling';
    copy.inert = !ready;
    if (ready) copy.removeAttribute('aria-hidden'); else copy.setAttribute('aria-hidden', 'true');
    $('intro-skip').hidden = ready;
    $('intro-replay').hidden = !ready;
  }
  function finishIntro() { intro = duration; syncCopy(true); wake(); }
  function state() {
    const seconds = intro / 1000;
    introTimeline.progress(clamp(intro/duration));journeyTimeline.progress(currentScrollPose);
    return {...(intro<duration?values:journeyValues),seconds,compact:innerWidth<=900,progress:currentScrollPose};
  }
  function releasePortal(){
    if(!portalActive)return;portalActive=false;app.classList.remove('portal-active');app.inert=false;app.removeAttribute('aria-hidden');
    for(const key of ['width','transform','max-height','opacity'])app.style.removeProperty(key);
    appSlot.style.removeProperty('min-height');
  }
  function syncPortal(p){
    const r=appSlot.getBoundingClientRect(),nativeTop=scrollY+r.top;
    if(reduced.matches===lastReduced&&(!enhanced||hero.offsetHeight===lastStoryHeight)){appAbsoluteTop=nativeTop;lastStableScrollY=scrollY;}
    if(!enhanced||scrollY>=nativeTop-90){releasePortal();app.style.removeProperty('visibility');if(demoFocusPending&&Math.abs(scrollY-demoFocusTarget)<=2){demoFocusPending=false;$('sample-select').focus({preventScroll:true});}return;}
    if(p<.82){releasePortal();app.style.visibility='hidden';return;}
    app.style.visibility='visible';
    if(!portalActive){appSlot.style.minHeight=app.getBoundingClientRect().height+'px';app.classList.add('portal-active','visible');portalActive=true;app.inert=true;app.setAttribute('aria-hidden','true');}
    const width=r.width,compact=innerWidth<=900,q=smooth((p-.84)/.16),initialScale=Math.min(.31,(compact?innerWidth*.5:innerWidth*.28)/width);
    const scale=initialScale+(1-initialScale)*q,maxHeight=Math.max(350,innerHeight-135);
    const initialX=innerWidth*(compact?.5:.75)-width*initialScale/2;
    const initialY=innerHeight*(compact?.26:.46)-maxHeight*initialScale/2;
    const x=initialX+(r.left-initialX)*q,y=initialY+(90-initialY)*q;
    app.style.width=width+'px';app.style.maxHeight=maxHeight+'px';app.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
    app.style.opacity=String(smooth((p-.82)/.045));
  }
  function updateChapters(p){
    if(!enhanced){copy.style.removeProperty('opacity');copy.style.removeProperty('visibility');copy.inert=intro<duration;chapters.forEach(a=>{a.style.removeProperty('opacity');a.removeAttribute('aria-hidden');a.inert=false;});activeChapter=-1;return;}
    const heroFade=1-smooth((p-.13)/.06);
    copy.style.opacity=intro<duration?'0':String(heroFade);copy.style.visibility=p<.195?'visible':'hidden';copy.inert=intro<duration||heroFade<.85;
    const ranges=[[.18,.245,.30,.335],[.335,.39,.51,.555],[.555,.61,.69,.735],[.735,.78,.84,.885]];
    activeChapter=-1;
    chapters.forEach((a,i)=>{const [start,settle,hold,end]=ranges[i],alpha=smooth((p-start)/(settle-start))*(1-smooth((p-hold)/(end-hold)));
      a.style.opacity=alpha.toFixed(3);a.style.setProperty('--chapter-offset',(18*(1-alpha)).toFixed(1)+'px');a.style.setProperty('--chapter-blur',(5*(1-alpha)).toFixed(1)+'px');a.classList.toggle('active',alpha>.01);
      a.inert=alpha<.8;if(alpha<.01)a.setAttribute('aria-hidden','true');else a.removeAttribute('aria-hidden');if(alpha>.4)activeChapter=i;
    });
    rail.style.setProperty('--journey-progress',clamp(p/.87)*100+'%');
    rail.querySelectorAll('[data-go]').forEach((li,i)=>{if(i===activeChapter)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
    rail.style.opacity=String(1-smooth((p-.85)/.08));
    $('journey-cue').style.opacity=String(1-smooth((p-.84)/.06));
    const controls=hero.querySelector('.intro-controls');controls.style.opacity=String(1-smooth((p-.82)/.08));controls.inert=p>=.90;
  }
  function configureStory(){
    scrollTrigger?.kill();scrollTrigger=null;releasePortal();const minimum=innerWidth<=600?800:innerWidth<=900?1000:720;enhanced=!reduced.matches&&innerWidth>=360&&innerHeight>=minimum;
    document.body.classList.toggle('story-enhanced',enhanced);document.body.classList.toggle('static-story',!enhanced);
    // svh can be smaller than innerHeight when Safari's chrome is collapsed.
    if(enhanced&&stageHost.offsetHeight<minimum){enhanced=false;document.body.classList.remove('story-enhanced');document.body.classList.add('static-story');}
    if(!enhanced&&renderer){renderer.dispose();renderer=null;document.body.dataset.renderer='css';}
    if(enhanced)scrollTrigger=ScrollTrigger.create({trigger:hero,start:'top top',end:()=>'+='+Math.max(1,hero.offsetHeight-stageHost.offsetHeight),invalidateOnRefresh:true,onUpdate:self=>{scrollPose=self.progress;wake();}});
    else{scrollPose=currentScrollPose=0;}
    lastViewportWidth=innerWidth;lastStageHeight=stageHost.offsetHeight;lastStoryHeight=hero.offsetHeight;rendered='';renderer?.resize();onScroll();wake();gsap.ticker.sleep();
  }
  function drawArt() {
    const s = state(), key = [intro===duration,s.seconds.toFixed(3),s.progress.toFixed(4),enhanced,scrollY].join('/');
    if (key === rendered) return;
    rendered = key;
    art.style.setProperty('--art-shift', s.shift.toFixed(3));
    art.style.setProperty('--door',s.door.toFixed(3));art.style.setProperty('--arrival',s.arrival.toFixed(3));
    art.style.setProperty('--city-opacity',s.city.toFixed(3));
    art.style.setProperty('--explode',s.explode.toFixed(3));art.style.setProperty('--connections',s.connections.toFixed(3));art.style.setProperty('--flight',s.fileFlight.toFixed(3));
    art.style.setProperty('--report',s.report.toFixed(3));
    art.style.setProperty('--view-x',(s.cameraX*7).toFixed(2));art.style.setProperty('--view-y',(s.cameraY*3).toFixed(2));
    art.style.setProperty('--scan-y', (s.scan * 280+15).toFixed(1) + 'px');
    art.style.setProperty('--scan-opacity', (s.scanOpacity * .7).toFixed(2));
    art.style.setProperty('--logo-opacity',s.logo.toFixed(3));
    art.style.opacity=String(1-smooth((s.progress-.87)/.115));
    $('art-stage').textContent = intro<duration?(s.seconds<1.3?'Boundary / Initialize':s.seconds<2.5?'Mod / Intake':s.seconds<4.4?'Static inspection':'GTA Guard / Ready'):['Identify','Inspect','Analyze','Decide'][Math.max(0,activeChapter)];
    updateChapters(s.progress);syncPortal(s.progress);
    // The native panel owns the viewport after the camera handoff. Do not
    // spend GPU time on an invisible world underneath it.
    if (renderer && heroVisible && s.progress<.985) renderer.draw(s);
  }
  function updateApp() {
    const step = Math.min(3, Math.floor(scan / scanDuration * 4));
    const data = scenario(), name = filename(), progress = completed ? 100 : Math.floor(scan / scanDuration * 100);
    const key = [selected, name, progress, scanning, completed].join('/');
    if (key === paint) return;
    paint = key;
    stages.forEach((li, i) => {
      li.classList.toggle('active', scanning && step === i);
      li.classList.toggle('done', completed || scanning && i < step);
      li.classList.toggle('incomplete', selected === 1 && (completed || scanning && step >= 2) && i === 2);
      li.querySelector('small').textContent = (completed || scanning && i < step) ? (i === 2 && selected === 1 ? 'Evidence missing' : 'Complete') : scanning && i === step ? 'In progress' : 'Waiting';
      if (scanning && i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('scan-button').disabled = scanning;
    $('scan-button').firstChild.textContent = scanning ? 'Following evidence ' : completed ? 'Replay example ' : 'Inspect example ';
    $('trace-progress').textContent = scanning ? progress + '%' : completed ? 'Finished' : 'Ready';
    $('scan-progress').setAttribute('aria-valuenow', String(progress));
    $('scan-progress').style.setProperty('--scan-progress', progress + '%');
    const lines = [];
    if (scanning || completed) {
      lines.push('Illustrative sample: ' + name + '\n');
      for (let i = 0; i < 4; i++) {
        const line = ['Identify', 'Inspect', 'Analyze', 'Decide'][i] + '\n' + data.trace[i];
        const fraction = completed ? 1 : clamp((scan - i * 2200) / 1800);
        if (fraction > 0) lines.push(line.slice(0, Math.ceil(line.length * fraction)));
      }
    }
    $('analysis-log').textContent = lines.length ? lines.join('\n\n') : 'Choose an invented scenario to follow its evidence.';
    $('result-title').textContent = completed ? data.verdict : scanning ? 'Following the evidence.' : 'Evidence before confidence.';
    $('result-detail').textContent = completed ? data.detail : scanning ? 'The illustration is still in progress. Wait for the coverage check and final decision.' : 'The demo has not started. A filename alone cannot establish safety.';
    const panel = document.querySelector('.result-panel');
    panel.style.setProperty('--outcome-color', completed ? data.color : '#dceaf7');
    panel.dataset.coverage = completed ? selected === 1 ? 'incomplete' : 'complete' : 'waiting';
    $('coverage-label').textContent = completed ? selected === 1 ? 'Incomplete' : 'Demo checks complete' : scanning ? 'Checking' : 'Not assessed';
    $('evidence-name').textContent = name;
    $('evidence-format').textContent = scanning || completed ? data.format : 'Awaiting illustration';
    $('evidence-finding').textContent = completed ? data.finding : scanning ? 'Following the fictional evidence; no final finding yet.' : 'No evidence shown yet';
    $('evidence-coverage').textContent = completed ? data.coverage : 'Not assessed';
    $('scanner-app').dataset.state = completed ? 'complete' : scanning ? 'running' : 'ready';
    $('scanner-app').dataset.stage = scanning || completed ? String(step) : '-1';
  }
  function completeScan() {
    scanning = false; completed = true; scan = scanDuration; updateApp();
    $('scan-announcement').textContent = scenario().verdict + '. ' + scenario().detail;
  }
  function startScan(e) {
    e?.preventDefault();
    if (scanning) return;
    scan = 0; scanning = true; completed = false; paint = '';
    $('scan-announcement').textContent = 'Illustrative analysis started. No real file is accessed.';
    updateApp();
    if (still()) completeScan(); else wake();
  }
  function choose(index) {
    selected = clamp(index, 0, 3); scan = 0; scanning = completed = false; paint = '';
    $('sample-name').value = scenario().name; $('sample-select').value = String(selected);
    $('scan-announcement').textContent = ''; updateApp();
  }
  function frame(ts) {
    raf = 0;
    if (disposed || document.hidden) { previous = 0; return; }
    // Some browser preference updates precede the MediaQueryList event.
    // Reconcile in the active frame too, so loading cannot strand hidden copy.
    if(reduced.matches!==lastReduced)motionPreferenceChanged();
    const delta = previous ? Math.max(0, ts - previous) : 0;
    previous = ts;
    if (intro < duration && heroVisible && !still() && !rendererLoading) {
      intro = Math.min(duration, intro + delta);
      if (intro === duration) syncCopy(true);
    }
    if (scanning && appVisible && !still()) {
      scan = Math.min(scanDuration, scan + delta);
      if (scan === scanDuration) completeScan(); else updateApp();
    }
    const follow = still()?1:1 - Math.exp(-delta / 260);
    currentPointer.x += (pointer.x - currentPointer.x) * follow;
    currentPointer.y += (pointer.y - currentPointer.y) * follow;
    currentScrollPose += (scrollPose - currentScrollPose) * follow;
    drawArt();
    const following = Math.abs(scrollPose-currentScrollPose)>.00012;
    if ((intro < duration && heroVisible || scanning && appVisible || following) && !still()) raf = requestAnimationFrame(frame);
    else {previous = 0;gsap.ticker.sleep();}
  }
  function wake() { if (!raf && !disposed && !document.hidden) raf = requestAnimationFrame(frame); }
  function fallback() {
    renderFailed = true;
    renderer?.dispose(); renderer = null;
    document.body.dataset.renderer = 'css';
    $('gta-scene').replaceChildren(); rendered = ''; wake();
  }
  async function loadScene() {
    if (rendererLoading || renderer || renderFailed || disposed) return;
    const weak = !enhanced || innerWidth <= 600 || innerHeight<720 || (navigator.deviceMemory || 8) <= 2;
    if (weak || reduced.matches) { document.body.dataset.renderer = 'css'; return; }
    rendererLoading = true;
    try {
      if (!window.createMalGuardGTAScene) {
        await new Promise((resolve, reject) => {
          const embedded = $('gta-scene-embedded');
          const script = document.createElement('script');
          const timeout = setTimeout(() => { script.remove(); reject(Error('Scene unavailable')); }, 9000);
          if (embedded) {
            script.textContent = atob(embedded.textContent.trim());
            document.head.append(script); clearTimeout(timeout); resolve();
          } else {
            script.src = '/assets/fusion/gta-guard-scene.js?v=20261008-journey'; script.onload = () => { clearTimeout(timeout); resolve(); };
            script.onerror = () => { clearTimeout(timeout); reject(Error('Scene unavailable')); };
            document.head.append(script);
          }
        });
      }
      if(disposed||reduced.matches||!enhanced){document.body.dataset.renderer='css';return;}
      const created = await window.createMalGuardGTAScene($('gta-scene'), { lite: matchMedia('(pointer:coarse)').matches || innerWidth <= 1100, onContextLost: fallback });
      if (disposed || renderFailed || reduced.matches || !enhanced) { created.dispose(); return; }
      renderer = created; sceneLoadedAt = performance.now();
      document.body.dataset.renderer = 'webgl'; previous=0; rendered = ''; drawArt(); wake();
    } catch { fallback(); }
    finally { rendererLoading = false; }
  }
  function onScroll() {
    // WebKit may clamp scrolling as reduced-motion CSS changes the story height
    // before updating MediaQueryList.matches. Keep the last stable anchor.
    if(reduced.matches===lastReduced&&(!enhanced||hero.offsetHeight===lastStoryHeight))lastStableScrollY=scrollY;
    if (scrollY > 80 && intro < duration) finishIntro();
    scrollPose = enhanced ? clamp(scrollY/Math.max(1,hero.offsetHeight-stageHost.offsetHeight)):0;
    wake();
  }
  listen($('intro-skip'), 'click', finishIntro);
  listen($('intro-replay'), 'click', () => { if (still()) { finishIntro(); return; }scrollTo({top:0,behavior:'instant'});scrollPose=currentScrollPose=0;releasePortal();intro = 0; previous = 0; rendered = ''; syncCopy(false); wake(); });
  listen($('motion-toggle'), 'click', () => {
    paused = !paused; document.body.classList.toggle('motion-paused', paused);
    $('motion-toggle').setAttribute('aria-pressed', String(paused));
    $('motion-toggle').textContent = paused ? 'Resume motion' : 'Pause motion';
    if (paused) { finishIntro(); if (scanning) completeScan(); pointer = { x: 0, y: 0 }; currentPointer = { x: 0, y: 0 }; }
    rendered = ''; wake();
  });
  function motionPreferenceChanged(){
    if(reduced.matches===lastReduced)return;
    const anchored=appAbsoluteTop>0&&(lastStableScrollY>=appAbsoluteTop-90||app.contains(document.activeElement));
    const viewportTop=appAbsoluteTop-lastStableScrollY;
    motionTransition={reduced:reduced.matches,anchored,viewportTop,appAbsoluteTop,lastStableScrollY,beforeScroll:scrollY};
    lastReduced=reduced.matches;
    if(reduced.matches){finishIntro();if(scanning)completeScan();renderer?.dispose();renderer=null;document.body.dataset.renderer='css';}
    configureStory();
    if(anchored){const top=scrollY+appSlot.getBoundingClientRect().top;motionTransition.target=clamp(top-viewportTop,0,document.documentElement.scrollHeight-innerHeight);scrollTo({top:motionTransition.target,behavior:'instant'});onScroll();}
    rendered='';wake();if(!reduced.matches&&heroVisible)loadScene();
  }
  listen(reduced, 'change', motionPreferenceChanged);
  // A preference change can alter layout before a MediaQueryList notification.
  // Wake outside the observer callback to avoid a ResizeObserver feedback loop.
  const preferenceLayout=new ResizeObserver(()=>{if(reduced.matches!==lastReduced)wake();});
  preferenceLayout.observe(stageHost);cleanups.push(()=>preferenceLayout.disconnect());
  listen(window,'focus',()=>{if(reduced.matches!==lastReduced)motionPreferenceChanged();else wake();});
  listen($('sample-form'), 'submit', startScan);
  listen($('sample-select'), 'change', () => choose(Number($('sample-select').value)));
  listen($('sample-name'), 'input', () => { selected = 1; scan = 0; scanning = completed = false; $('sample-select').value = '1'; paint = ''; $('scan-announcement').textContent = ''; updateApp(); });
  listen(window, 'scroll', onScroll, { passive: true });
  listen(document,'click',e=>{const link=e.target.closest('a[href="#scanner"]');if(!link)return;e.preventDefault();finishIntro();demoFocusPending=true;releasePortal();requestAnimationFrame(()=>{demoFocusTarget=clamp(appSlot.getBoundingClientRect().top+scrollY-84,0,document.documentElement.scrollHeight-innerHeight);history.replaceState(null,'','#scanner');scrollTo({top:demoFocusTarget,behavior:still()?'instant':'smooth'});wake();});});
  let resizeTimer;
  listen(window, 'resize', () => {clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
    // Address-bar movement must not rebuild a sticky story when svh is stable.
    if(matchMedia('(pointer:coarse)').matches&&innerWidth===lastViewportWidth&&stageHost.offsetHeight===lastStageHeight){renderer?.resize();rendered='';wake();return;}
    configureStory();const r=hero.getBoundingClientRect();if(enhanced&&r.top<innerHeight+150&&r.bottom>-150)loadScene();
  },160);}, { passive: true });
  listen(document, 'visibilitychange', () => { cancelAnimationFrame(raf); raf = 0; previous = 0; if (!document.hidden) wake(); });
  const visibility = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.target === hero) heroVisible = entry.isIntersecting; else appVisible = entry.isIntersecting; } previous = 0; wake(); }, { threshold: 0 });
  visibility.observe(hero); visibility.observe(app);
  const revealObserver = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } }, { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(e => revealObserver.observe(e));
  const near = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { loadScene(); near.disconnect(); } }, { rootMargin: '150px' }); near.observe(hero);
  function dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(raf);clearTimeout(resizeTimer);scrollTrigger?.kill();introTimeline.kill();journeyTimeline.kill();releasePortal();visibility.disconnect(); revealObserver.disconnect(); near.disconnect(); renderer?.dispose(); cleanups.splice(0).forEach(fn => fn()); }
  listen(window, 'pagehide', e => { if (!e.persisted) dispose(); else { cancelAnimationFrame(raf); raf = 0; previous = 0; } });
  listen(window, 'pageshow', () => { previous = 0; wake(); });
  document.body.classList.add('intro-controlled');
  syncCopy(false); updateApp();configureStory();if (still() || location.hash || scrollY > 80) finishIntro(); else wake();
  window.MalGuardGTA = {
    snapshot: () => ({ intro, ready: intro === duration, selected, filename: filename(), scanning, completed, progress: scan / scanDuration, paused, renderer: document.body.dataset.renderer || 'css', renderFailed, sceneLoadedAt, scene: renderer?.metrics(), raf: Boolean(raf),journey:currentScrollPose,chapter:activeChapter,enhanced,portalActive,duration,storyLength:hero.offsetHeight-stageHost.offsetHeight,motionTransition }),
    loseContext: () => renderer?.loseContext()
  };
})();
