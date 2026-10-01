(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');
  let userPaused = false;
  try { userPaused = localStorage.getItem('malguard-motion-paused') === 'true'; } catch (_) {}
  function applyMotion() {
    const paused = motion.matches || userPaused;
    document.documentElement.classList.toggle('motion-paused', paused);
    if (toggle) { toggle.textContent = motion.matches ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'; toggle.setAttribute('aria-pressed', String(paused)); toggle.disabled = motion.matches; }
    window.dispatchEvent(new Event('malguard-motion'));
  }
  applyMotion();
  motion.addEventListener('change', applyMotion);
  toggle?.addEventListener('click', () => { userPaused = !userPaused; try { localStorage.setItem('malguard-motion-paused', String(userPaused)); } catch (_) {} applyMotion(); });
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('page-hidden', document.hidden));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
  }
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('[data-tilt]').forEach(card => {
    let frame = 0;
    card.addEventListener('pointermove', e => {
      if (!pointer.matches || motion.matches || userPaused) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--tilt-y', `${((e.clientX-r.left)/r.width-.5)*9}deg`);
        card.style.setProperty('--tilt-x', `${((e.clientY-r.top)/r.height-.5)*-7}deg`);
      });
    });
    card.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
  });
  const dialog = document.getElementById('coreDialog');
  const open = document.getElementById('openCore');
  if (dialog && open) {
    open.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('[data-close-core]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => open.focus());
  }
  // Keep old shared homepage product links pointing to the supported pages.
  if (document.body.classList.contains('mg-home')) {
    const legacy = {'#gta-guard':'/gta-guard.html','#malware-ai':'/malware-ai.html','#game-scam-guard':'/products.html#game-scam-guard','#download':'/download.html','#feedback':'/support.html'};
    function routeLegacy() { if (legacy[location.hash]) location.replace(legacy[location.hash]); }
    window.addEventListener('hashchange', routeLegacy); routeLegacy();
  }
  document.documentElement.dataset.experienceReady = "true";
})();


/* Spatial product inspection. Native dialogs retain keyboard and focus semantics. */
(() => {
 'use strict';
 const root=document.documentElement;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const paused=()=>reduced.matches||root.classList.contains('motion-paused');
 const cards=[...document.querySelectorAll('.orbit-product')];
 const dialog=document.getElementById('productInspector');
 let origin=null,flight=null,flightAnimation=null,closing=false,closeTimer=0;
 const paragraphs=[...document.querySelectorAll('.evidence-notes>div')];
 const stopFlight=()=>{flightAnimation?.cancel();flight?.remove();flight=null;flightAnimation=null;};
 const field=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
 function lift(card,closing=false){
  if(paused()||!card||!dialog?.open)return;
  stopFlight();
  const a=card.getBoundingClientRect(),b=document.getElementById('inspectorObject').getBoundingClientRect();
  if(a.bottom<0||a.top>innerHeight)return;
  const clone=card.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
  clone.querySelectorAll('button,a').forEach(e=>e.tabIndex=-1);
  clone.classList.add('product-flight');clone.setAttribute('aria-hidden','true');clone.inert=true;
  Object.assign(clone.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});
  dialog.append(clone);flight=clone;
  const dx=b.left-a.left,dy=b.top-a.top,sx=b.width/a.width,sy=b.height/a.height;
  const start={transform:'translate(0,0) scale(1) rotateY(0deg)',opacity:1};
  const middle={transform:'translate('+dx*.55+'px,'+dy*.55+'px) scale('+((1+sx)/2)+','+((1+sy)/2)+') rotateY(-24deg) rotateZ(-5deg)',opacity:.85,offset:.55};
  const end={transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+') rotateY(-14deg)',opacity:0};
  flightAnimation=clone.animate(closing?[end,middle,start]:[start,middle,end],{duration:closing?380:680,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
  flightAnimation.finished.then(stopFlight).catch(()=>{});
 }
 if(dialog){
  cards.forEach((card,i)=>{
   const button=card.querySelector('[data-product-inspect]');
   if(!button)return;
   button.setAttribute('aria-label','Inspect '+card.querySelector('h3').textContent+' details');
   button.addEventListener('click',()=>{
    if(dialog.open)return;
    origin=button;
    field('inspectorTitle',card.querySelector('h3').textContent);
    field('inspectorDescription',card.querySelector('p').textContent);
    field('inspectorMeta',card.querySelector('.orbit-product-meta').textContent);
    const status=document.getElementById('inspectorStatus');status.textContent=card.querySelector('.orbit-status').textContent;status.className=card.querySelector('.orbit-status').className;
    const note=paragraphs[i===2?2:i];field('inspectorHeading',note?.querySelector('h3')?.textContent||'Availability, in view.');
    field('inspectorEvidence',i===2?'A focused approach to gaming scams and suspicious destinations. Currently in development. Planned product · No public release':note?.querySelector('p')?.textContent||'');
    const link=document.getElementById('inspectorLink'),source=card.querySelector('.orbit-card-link');link.href=source.getAttribute('href');link.textContent=source.textContent;
    const object=document.getElementById('inspectorObject');object.replaceChildren(card.querySelector('.product-art').cloneNode(true));
    dialog.showModal();lift(card);
    if(!paused())dialog.querySelector('.inspector-details').animate([{opacity:0,transform:'translateY(15px)'},{opacity:1,transform:'none'}],{duration:580,delay:160,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'});
   });
  });

  function requestClose(){
   if(closing)return;
   if(paused()){dialog.close();return;}
   closing=true;
   lift(origin?.closest('.orbit-product'),true);
   dialog.querySelector('.inspector-grid').animate([{opacity:1},{opacity:0}],{duration:280,fill:'both'});
   closeTimer=setTimeout(()=>dialog.close(),390);
  }
  document.getElementById('closeInspector').addEventListener('click',requestClose);
  dialog.addEventListener('cancel',e=>{e.preventDefault();requestClose();});

  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)requestClose();});
  dialog.addEventListener('close',()=>{clearTimeout(closeTimer);closing=false;stopFlight();dialog.querySelector('.inspector-grid').getAnimations().forEach(a=>a.cancel());origin?.focus({preventScroll:true});});
  window.addEventListener('malguard-motion',()=>{if(paused()){if(closing){clearTimeout(closeTimer);dialog.close();}stopFlight();dialog.getAnimations({subtree:true}).forEach(a=>{if(a.effect?.getTiming().iterations!==Infinity)a.finish();});}});
 }
 cards.forEach(card=>{
  let raf=0;
  card.addEventListener('pointermove',e=>{
   if(paused()||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
   cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=card.getBoundingClientRect();card.style.setProperty('--sheen-x',(e.clientX-r.left)/r.width*100+'%');card.style.setProperty('--sheen-y',(e.clientY-r.top)/r.height*100+'%');});
  });
  card.addEventListener('pointerleave',()=>{cancelAnimationFrame(raf);card.style.removeProperty('--sheen-x');card.style.removeProperty('--sheen-y');});
 });
 const copy=document.getElementById('studioCopyCode'),code=document.getElementById('studioCode'),status=document.getElementById('studioCopyStatus');
 copy?.addEventListener('click',async()=>{
  status.textContent='';
  try{if(!navigator.clipboard?.writeText)throw Error('Unavailable');await navigator.clipboard.writeText(code.textContent);status.textContent='Example copied';}
  catch(_){const selection=getSelection(),range=document.createRange();range.selectNodeContents(code);selection?.removeAllRanges();selection?.addRange(range);status.textContent='Select and copy the highlighted example';}
 });
 root.dataset.collectionReady='true';
})();

/* Deterministic evidence lens. No WebGL, tracking, remote assets or scrolling interception. */
(() => {
 'use strict';
 const root=document.documentElement,canvas=document.getElementById('evidenceField'),scene=document.getElementById('securityScene');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const paused=()=>reduced.matches||root.classList.contains('motion-paused');
 const line=document.createElement('div');line.className='scroll-reading-line';line.setAttribute('aria-hidden','true');document.body.append(line);
 let scrollRAF=0;
 const sculptures=[...document.querySelectorAll('.orbit-product')];sculptures.forEach((card,i)=>card.style.setProperty('--reveal-order',String(i)));
 function scroll(){scrollRAF=0;if(!paused()){sculptures.forEach(card=>{const r=card.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const p=Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight*.7)));card.style.setProperty('--art-drift',((1-p)*16)+'px');card.style.setProperty('--art-angle',((1-p)*6)+'deg');});}const max=root.scrollHeight-root.clientHeight;line.style.transform='scaleX('+(max?Math.min(1,scrollY/max):0)+')';if(scene&&!paused()){const p=Math.min(1,scrollY/Math.max(1,innerHeight));scene.style.setProperty('--core-x',(6+p*9)+'deg');}}
 function scheduleScroll(){if(!scrollRAF)scrollRAF=requestAnimationFrame(scroll);}
 addEventListener('scroll',scheduleScroll,{passive:true});addEventListener('resize',scheduleScroll);
 if('ResizeObserver'in window)new ResizeObserver(scheduleScroll).observe(document.body);
 scroll();
 if(!canvas||!scene)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 let width=0,height=0,frame=0,last=0,phase=0,visible=true,px=0,py=0,tx=0,ty=0,frames=0;
 const points=[];
 for(let u=0;u<64;u++)for(let v=0;v<12;v++)points.push({u:u/64*Math.PI*2,v:v/12*Math.PI*2});
 root.dataset.fieldPointCount=String(points.length);
 function draw(now=0){
  frame=0;
  if(!paused()&&now-last<32){frame=requestAnimationFrame(draw);return;}
  const elapsed=Math.min(50,Math.max(0,now-last||0));last=now;
  if(!paused()){phase+=elapsed*.00012;px+=(tx-px)*.07;py+=(ty-py)*.07;}
  ctx.clearRect(0,0,width,height);
  const radius=Math.min(width*.39,height*.35),tube=radius*.2;
  const a=.98+py*.2,c=Math.cos(a),s=Math.sin(a),rotation=phase+px*.22;
  const rendered=points.map(p=>{
   const u=p.u+rotation,rr=radius+tube*Math.cos(p.v);
   const x=rr*Math.cos(u),y=rr*Math.sin(u),z=tube*Math.sin(p.v)+Math.sin(p.u*3+phase)*9;
   const yy=y*c-z*s,zz=y*s+z*c,k=650/(650+zz);
   return{x:width/2+x*k,y:height*.49+yy*k,z:zz,k,highlight:p.v<.55};
  }).sort((a,b)=>b.z-a.z);
  for(const p of rendered){const alpha=.18+(.7-(p.z/radius)*.3);ctx.fillStyle=p.highlight?'rgba(215,255,164,'+Math.min(.85,alpha)+')':'rgba(174,199,231,'+Math.min(.68,alpha*.65)+')';ctx.beginPath();ctx.arc(p.x,p.y,(p.highlight?1.25:.78)*p.k,0,Math.PI*2);ctx.fill();}
  frames++;root.dataset.fieldFrames=String(frames);
  if(visible&&!document.hidden&&!paused()&&!document.body.classList.contains('site-entry-locked'))frame=requestAnimationFrame(draw);
 }
 function stop(){cancelAnimationFrame(frame);frame=0;}
 function sync(){stop();last=0;if(visible&&!document.hidden)draw(performance.now());}
 function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);sync();}
 new ResizeObserver(resize).observe(canvas);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;root.dataset.fieldVisible=String(visible);visible?sync():stop();},{threshold:.05}).observe(scene);
 scene.addEventListener('pointermove',e=>{if(paused()||!matchMedia('(pointer:fine)').matches)return;const r=scene.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;scene.style.setProperty('--core-y',(-12+tx*22)+'deg');});
 scene.addEventListener('pointerleave',()=>{tx=ty=0;scene.style.removeProperty('--core-y');});
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);window.addEventListener('malguard-motion',sync);
 const opener=document.getElementById('openCore'),dialog=document.getElementById('coreDialog');
 opener?.addEventListener('click',()=>{if(!paused())dialog.querySelector('img')?.animate([{transform:'rotateY(-75deg) scale(.8)',opacity:0},{transform:'rotateY(0deg) scale(1)',opacity:1}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)'});});
 resize();
})();
