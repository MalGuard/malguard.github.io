/* Presentation only. Authentication and reporting remain in their own modules. */
(() => {
 'use strict';
 const body=document.body;if(!body.classList.contains('secure-page'))return;
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)'),story=document.querySelector('.secure-story'),panel=document.querySelector('.secure-panel');
 if(!story||!panel)return;
 const admin=!!document.getElementById('siteEntryGate'),animations=new Set(),removers=[];let state='idle',typingTimer=0,dormant=false,initialFocus=true,userActivated=false,lastAdminPhase='idle';
 function listen(target,type,fn,options){target.addEventListener(type,fn,options);removers.push(()=>target.removeEventListener(type,fn,options));}
 const stopped=()=>reduced.matches||root.classList.contains('motion-paused')||document.hidden||dormant;
 function animate(target,frames,options){if(stopped()||!target?.animate)return null;const animation=target.animate(frames,{fill:'backwards',...options});animations.add(animation);animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));return animation;}
 const scene=document.createElement('div');scene.id='secure-scene';scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="secure-horizon"></div><svg class="secure-routes" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="secure-route-light"><stop stop-color="#5178cc" stop-opacity="0"/><stop offset=".5" stop-color="#89dcff"/><stop offset="1" stop-color="#5178cc" stop-opacity="0"/></linearGradient></defs>'+['M-90 920 C280 780 160 170 590 80 S1110 580 1540 190','M-90 965 C290 815 205 190 610 115 S1140 625 1540 230','M-90 1010 C310 850 240 230 640 150 S1170 670 1540 270'].map((d,i)=>'<path class="route-base" d="'+d+'"/><path class="route-flow" style="--route:'+i+'" pathLength="100" d="'+d+'"/>').join('')+'</svg>';body.prepend(scene);
 const stage=document.createElement('div');stage.className='secure-vault-stage';stage.setAttribute('aria-hidden','true');stage.innerHTML='<div class="vault-ground"></div><div class="secure-vault">'+Array.from({length:6},(_,i)=>'<div class="vault-slab" style="--slab:'+i+'"><i class="vault-rail top"></i><i class="vault-rail bottom"></i><i class="vault-rail left"></i><i class="vault-rail right"></i><span class="vault-strand"></span></div>').join('')+'<div class="vault-core"><img src="/assets/fusion/assets/malguard-logo.svg" width="108" height="124" alt=""/><svg viewBox="0 0 64 64" class="vault-approval"><path d="m15 33 11 11 24-24"/></svg></div><div class="vault-crossbeam one"></div><div class="vault-crossbeam two"></div></div>';
 story.querySelector('.signal-caption').before(stage);
 const replay=document.createElement('button');replay.type='button';replay.className='secure-start';replay.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v9M6.4 5.8a8 8 0 1 0 11.2 0"/></svg><span data-i18n-dynamic></span>';stage.after(replay);
 function localize(){const label=replay.querySelector('span'),value=root.lang==='fa'?(admin?'شروع ورود امن':'شروع گزارش'):(admin?'Start secure access':'Start a report');if(label.textContent!==value)label.textContent=value;}
 localize();listen(window,'malguard-language',localize);const localeObserver=new MutationObserver(localize);localeObserver.observe(root,{attributes:true,attributeFilter:['lang']});
 const perimeter=document.createElementNS('http://www.w3.org/2000/svg','svg');perimeter.classList.add('kinetic-perimeter');perimeter.setAttribute('viewBox','0 0 100 100');perimeter.setAttribute('preserveAspectRatio','none');perimeter.setAttribute('aria-hidden','true');perimeter.innerHTML='<rect x=".4" y=".4" width="99.2" height="99.2" rx="4" pathLength="100"/>';panel.prepend(perimeter);
 for(const input of panel.querySelectorAll('input:not([type=checkbox]),textarea,select')){if(input.id==='reportWebsite')continue;input.classList.add('kinetic-input');}
 const primarySelector='#reportSubmit,#siteAdminPasswordSubmit,#siteAdminEnter';
 function setState(next){state=next;body.dataset.secureState=next;const busy=['checking','sending','confirming'].includes(next);panel.setAttribute('aria-busy',String(busy));for(const button of panel.querySelectorAll(primarySelector))button.dataset.motionState=button.disabled&&busy?'busy':next==='success'?'success':'idle';}
 function entrance(){animate(stage.querySelector('.secure-vault'),[{opacity:0,transform:'translate3d(0,50px,-130px) rotateX(34deg) rotateY(-52deg)'},{opacity:1,transform:'translate3d(0,0,0) rotateX(12deg) rotateY(-25deg)'}],{duration:1000,easing:'cubic-bezier(.16,1,.3,1)'});}
 listen(replay,'click',()=>{entrance();const input=panel.querySelector('.site-entry-step:not([hidden]) input')||document.getElementById('reportMessage');input?.focus({preventScroll:true});input?.scrollIntoView({block:'center',behavior:stopped()?'auto':'smooth'});});
 if(admin){
  const gate=document.getElementById('siteEntryGate');
  const gateControls=()=>[...gate.querySelectorAll('button,input,a,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('[hidden]'));
  listen(gate,'keydown',event=>{if(event.key!=='Tab'||gate.querySelector('dialog[open]'))return;const controls=gateControls();if((event.shiftKey&&document.activeElement===controls[0])||(!event.shiftKey&&document.activeElement===controls.at(-1))){event.preventDefault();event.stopPropagation();replay.focus();}},true);
  listen(replay,'keydown',event=>{if(event.key!=='Tab')return;event.preventDefault();const controls=gateControls();(event.shiftKey?controls.at(-1):controls[0])?.focus();});
 }
 listen(body,'keydown',()=>{userActivated=true;});
 listen(body,'pointerdown',event=>{userActivated=true;const button=event.target.closest('button');if(!button||!button.closest('.secure-layout')||button.disabled)return;const icon=button.querySelector('svg');if(icon)animate(icon,[{transform:'scale(1)'},{transform:'scale(.84)'},{transform:'scale(1)'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});});
 listen(panel,'input',event=>{
  const input=event.target;if(!input.matches('input,textarea,select')||input.id==='reportWebsite')return;
  if(!['checking','sending','confirming'].includes(state)){setState('typing');clearTimeout(typingTimer);typingTimer=setTimeout(()=>{body.classList.remove('is-typing');setState(admin?inferAdminPhase():'idle');},1100);}
  body.classList.add('is-typing');
  if(input.dataset.passwordSignal){const track=document.getElementById(input.dataset.passwordSignal);if(track){const count=Math.min(18,input.value.length);while(track.children.length>count)track.lastElementChild.remove();while(track.children.length<count){const dot=document.createElement('span');dot.textContent='•';track.append(dot);animate(dot,[{opacity:0,transform:'translateY(9px) scale(.6)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});}}}
 });
 listen(panel,'focusin',event=>{
  if(admin&&initialFocus&&event.target.id==='siteAdminPassword'){initialFocus=false;if(innerWidth<=900&&!userActivated){const heading=story.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}}
  if(event.target.matches('input,textarea,select')){body.classList.add('secure-field-focused');animate(stage.querySelector('.vault-core'),[{transform:'translateZ(105px) scale(1)'},{transform:'translateZ(105px) scale(1.06)'},{transform:'translateZ(105px) scale(1)'}],{duration:650,easing:'ease-out'});}
 });
 listen(panel,'focusout',()=>{body.classList.remove('secure-field-focused');});
 listen(panel,'invalid',event=>{setState('error');animate(event.target,[{opacity:.6},{opacity:1}],{duration:320,easing:'ease-out'});},true);
 function respond(next){
  if(!['idle','checking','sending','identity','confirming','success','error'].includes(next))return;clearTimeout(typingTimer);body.classList.remove('is-typing');setState(next);
  const target=next==='identity'?document.getElementById('siteAdminIdentityStep'):panel.querySelector('#reportResult,.site-entry-error:not(:empty)');
  if(next==='error')animate(target,[{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:300,easing:'ease-out'});
  if(next==='identity')animate(target,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:500,easing:'cubic-bezier(.16,1,.3,1)'});
  if(next==='success')animate(stage.querySelector('.vault-approval'),[{opacity:0,transform:'scale(.75)'},{opacity:1,transform:'scale(1)'}],{duration:400,easing:'cubic-bezier(.16,1,.3,1)'});
 }
 listen(window,'mg:secure-state',event=>respond(event.detail?.state));
 // Observe existing auth UI states only; no auth request or access grant here.
 function inferAdminPhase(){const identity=document.getElementById('siteAdminIdentityStep');return document.getElementById('siteAdminEnter').disabled?'confirming':document.getElementById('siteAdminPasswordSubmit').disabled?'checking':!identity.hidden?(document.getElementById('siteAdminIdentityError').textContent.trim()?'error':'identity'):document.getElementById('siteAdminPasswordError').textContent.trim()?'error':'idle';}
 const attributeObserver=new MutationObserver(records=>{
  if(admin){const status=[document.getElementById('siteAdminPasswordError'),document.getElementById('siteAdminIdentityError')],controls=[document.getElementById('siteAdminEnter'),document.getElementById('siteAdminPasswordSubmit'),document.getElementById('siteAdminIdentityStep')];const relevant=records.some(r=>controls.includes(r.target)||status.some(el=>el===r.target||el.contains(r.target)));if(relevant){const phase=inferAdminPhase();if(phase!==lastAdminPhase||phase!==state){lastAdminPhase=phase;respond(phase);}}}
  for(const b of panel.querySelectorAll(primarySelector))b.dataset.motionState=b.disabled?'busy':state==='success'?'success':'idle';
 });attributeObserver.observe(panel,{subtree:true,attributes:true,attributeFilter:['disabled','hidden'],childList:true,characterData:true});
 function syncMotion(){
  const pause=stopped();body.classList.toggle('secure-motion-stopped',pause);
  const owned=new Set([...animations,...scene.getAnimations({subtree:true}),...stage.getAnimations({subtree:true}),...panel.getAnimations({subtree:true}),...replay.getAnimations({subtree:true})]);
  for(const a of owned){if(reduced.matches)a.cancel();else if(pause)a.pause();else if(a.playState==='paused')a.play();}
 }
 listen(window,'mg:motion',syncMotion);listen(reduced,'change',syncMotion);listen(document,'visibilitychange',syncMotion);
 const observer=new IntersectionObserver(entries=>{dormant=!entries[0].isIntersecting;syncMotion();},{rootMargin:'100px'});observer.observe(document.querySelector('main'));
 listen(window,'pagehide',event=>{dormant=true;syncMotion();if(!event.persisted){clearTimeout(typingTimer);observer.disconnect();attributeObserver.disconnect();localeObserver.disconnect();for(const a of animations)a.cancel();for(const remove of removers)remove();}});listen(window,'pageshow',()=>{dormant=false;syncMotion();});
 window.MalGuardSecureMotion={snapshot:()=>({state,paused:stopped(),background:'kinetic-vault',activeAnimations:scene.getAnimations({subtree:true}).filter(a=>a.playState==='running').length})};
 setState('idle');syncMotion();entrance();
})();
