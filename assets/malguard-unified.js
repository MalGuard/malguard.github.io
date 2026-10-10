/* Presentation adapter only. Real analyzers, release checks and auth are owned
   by their existing modules. No upload, AI, installer or authentication calls. */
(()=>{
 'use strict';
 const root=document.documentElement,body=document.body,reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const home=body.classList.contains('mg-fusion'),gta=body.classList.contains('mg-gta');
 const research=body.classList.contains('mg-research-page');
 let control=document.getElementById('motionToggle')||document.getElementById('motion-toggle')||document.getElementById('motion')||document.querySelector('.motion-control');
 if(!control){control=document.createElement('button');control.type='button';control.className='mg-motion-toggle';control.id='motionToggle';body.append(control);}
 if(home)control.id='motionToggle';
 let saved=false;try{saved=localStorage.getItem('malguard-motion-paused')==='true';}catch{}
 function apply(paused,notify=true){
  const stop=reduced.matches||paused;root.classList.toggle('motion-paused',stop);body.classList.toggle('motion-paused',stop);
  control.setAttribute('aria-pressed',String(stop));control.textContent=reduced.matches?'Reduced motion':stop?'Resume motion':'Pause motion';control.disabled=reduced.matches;
  if(notify){window.dispatchEvent(new CustomEvent('mg:motion',{detail:{paused:stop}}));window.dispatchEvent(new Event('malguard-motion'));}
 }
 if(gta&&saved&&!reduced.matches&&window.MalGuardGTA&&!MalGuardGTA.snapshot().paused)control.click();
 if(research&&saved&&!reduced.matches&&!body.classList.contains('paused'))control.click();
 apply(saved);
 // The existing home button already owns its toggle. Persist its result;
 // other pages use this shared button without replacing their controls.
 control.addEventListener('click',()=>{
  const paused=research?body.classList.contains('paused'):home||gta?body.classList.contains('motion-paused'):!root.classList.contains('motion-paused');
  saved=paused;try{localStorage.setItem('malguard-motion-paused',String(saved));}catch{}apply(paused);
 });
 reduced.addEventListener('change',()=>apply(saved));
 document.addEventListener('visibilitychange',()=>root.classList.toggle('page-hidden',document.hidden));
 if(home){
  const legacy={'#gta-guard':'/gta-guard.html','#malware-ai':'/malware-ai.html','#game-scam-guard':'/game-scam-guard.html','#download':'/download.html','#feedback':'/support.html'};
  const route=()=>{if(legacy[location.hash])location.replace(legacy[location.hash]);};window.addEventListener('hashchange',route);route();
 }
 if(body.classList.contains('mg-content-page')){
  const hero=document.querySelector('main>section');
  const container=hero?.matches('.container')?hero:hero?.querySelector(':scope>.container');
  if(container&&hero.querySelector('h1')&&!hero.querySelector('form')&&!body.classList.contains('mg-app-page')){
   const copy=document.createElement('div');copy.className='mg-page-copy';copy.append(...container.childNodes);container.append(copy);container.classList.add('mg-page-hero');
   const art=document.createElement('div');art.className='mg-page-art';art.setAttribute('aria-hidden','true');
   art.innerHTML='<div class="mg-art-machine">'+Array.from({length:4},(_,i)=>'<i class="mg-art-frame" style="--i:'+i+'"><svg viewBox="0 0 200 200"><path d="M100 8 180 54 180 146 100 192 20 146 20 54Z"/></svg></i>').join('')+'<img class="mg-art-logo" src="/assets/fusion/assets/malguard-logo.svg" alt="" width="200" height="200"><i class="mg-art-scan"></i></div><span class="mg-art-coordinate">MALGUARD / EVIDENCE FIRST</span>';
   container.append(art);
  }
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('mg-visible');observer.unobserve(entry.target);}},{threshold:.25}):null;
  for(const el of document.querySelectorAll('main .section-head,main .mg-page-copy,main article:not(.tool),main .compare')){
   if(el.closest('.mg-app-shell')||el.querySelector('form,input,button,textarea'))continue;
   el.classList.add('mg-reveal');if(observer&&!reduced.matches&&!saved)observer.observe(el);else el.classList.add('mg-visible');
   el.addEventListener('focusin',()=>el.classList.add('mg-visible'));
  }
  for(const el of document.querySelectorAll('.product-entry,.platform-card'))el.classList.add('mg-border-orbit');
  for(const img of document.querySelectorAll('.product-entry img,.platform-card img,main img[src*="product-"]'))img.classList.add('mg-icon-motion');
 }
 // A modest hover response for the existing product icons. It never moves
 // the clickable surface or changes an application's coordinates.
 const fine=matchMedia('(hover:hover) and (pointer:fine)');
 for(const card of document.querySelectorAll('.mg-content-page .product-entry,.mg-content-page .platform-card')){
  let frame=0;
  card.addEventListener('pointermove',event=>{
   if(!fine.matches||reduced.matches||root.classList.contains('motion-paused'))return;
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const box=card.getBoundingClientRect();card.style.setProperty('--tilt-y',((event.clientX-box.left)/box.width-.5)*4+'deg');card.style.setProperty('--tilt-x',((event.clientY-box.top)/box.height-.5)*-3+'deg');});card.setAttribute('data-tilt','');
  });
  card.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');});
 }
 // Preserve the approved English film and add its short Persian headline
 // when the existing site language control switches to Persian.
 const titles=new Map();
 if(home){const heading=document.querySelector('.scene h1');if(heading)titles.set(heading,{en:heading.innerHTML,fa:'هوشمند اسکن کن.<br>ایمن بازی کن.'});}
 if(gta){const heading=document.getElementById('gta-title');if(heading)titles.set(heading,{en:heading.innerHTML,fa:'GTA Guard<span class="title-period">.</span>'});}
 function locale(){for(const [heading,copy]of titles){const next=root.lang==='fa'?copy.fa:copy.en;if(heading.dataset.unifiedLanguage!==root.lang){heading.innerHTML=next;heading.dataset.unifiedLanguage=root.lang;}}}
 window.addEventListener('malguard-language',locale);locale();
 root.dataset.experienceReady='true';root.dataset.unifiedReady='true';
})();
