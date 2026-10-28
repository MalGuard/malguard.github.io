/* Lightweight hero telemetry. No canvas, WebGL, or network. */
(()=>{
 'use strict';
 const art=document.querySelector('.security-art');
 const chart=document.querySelector('.telemetry-chart');
 const status=document.querySelector('.demo-status');
 if(!art||!chart)return;
 const presets={
  mixed:{clean:'72%',blocked:'28%',text:'Mixed examples · gray in, green / red out'},
  clean:{clean:'94%',blocked:'6%',text:'Clean only · verified local artifacts'},
  risky:{clean:'22%',blocked:'78%',text:'Risky only · blocked before use'}
 };
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let typing=0;
 function writeStatus(text){
  if(!status)return;
  const token=++typing;
  status.querySelector('.type-ink')?.remove();
  let source=status.querySelector('.type-source');
  if(!source){source=document.createElement('span');source.className='type-source';status.replaceChildren(source);}
  source.textContent=text;
  if(motion.matches){source.style.color='';status.dataset.typeState='complete';return;}
  source.style.color='transparent';
  const ink=document.createElement('span');ink.className='type-ink';ink.setAttribute('aria-hidden','true');status.append(ink);
  status.dataset.typeState='typing';
  let index=0;
  const step=()=>{
   if(token!==typing)return;
   if(motion.matches){ink.remove();source.style.color='';status.dataset.typeState='complete';return;}
   index+=1;ink.textContent=text.slice(0,index);
   if(index<text.length)setTimeout(step,16);
   else{ink.remove();source.style.color='';status.dataset.typeState='complete';}
  };
  step();
 }
 const apply=name=>{
  const preset=presets[name]||presets.mixed;
  art.dataset.verdict=name==='risky'?'flagged':name==='clean'?'clean':'mixed';
  chart.style.setProperty('--clean',preset.clean);
  chart.style.setProperty('--blocked',preset.blocked);
  const clean=chart.querySelector('[data-bar="clean"]');
  const blocked=chart.querySelector('[data-bar="blocked"]');
  if(clean)clean.setAttribute('width',String(parseFloat(preset.clean)*4.8));
  if(blocked)blocked.setAttribute('width',String(parseFloat(preset.blocked)*4.8));
  writeStatus(preset.text);
 };
 document.querySelectorAll('[data-example]').forEach(button=>{
  button.addEventListener('click',()=>{
   document.querySelectorAll('[data-example]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
   apply(button.dataset.example);
  });
 });
 const pause=document.querySelector('.motion-toggle');
 const syncMotion=()=>{if(pause)pause.hidden=motion.matches;};
 syncMotion();
 motion.addEventListener('change',syncMotion);
 pause?.addEventListener('click',()=>{
  const paused=pause.getAttribute('aria-pressed')==='true';
  pause.setAttribute('aria-pressed',String(!paused));
  pause.textContent=paused?'Pause motion':'Resume motion';
  art.classList.toggle('motion-active',paused);
 });
 const cleanBar=chart.querySelector('[data-bar="clean"]');
 const blockedBar=chart.querySelector('[data-bar="blocked"]');
 if(cleanBar)cleanBar.setAttribute('width','346');
 if(blockedBar)blockedBar.setAttribute('width','134');
})();
