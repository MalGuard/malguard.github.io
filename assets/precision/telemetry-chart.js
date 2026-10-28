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
 const apply=name=>{
  const preset=presets[name]||presets.mixed;
  art.dataset.verdict=name==='risky'?'flagged':name==='clean'?'clean':'mixed';
  chart.style.setProperty('--clean',preset.clean);
  chart.style.setProperty('--blocked',preset.blocked);
  const clean=chart.querySelector('[data-bar="clean"]');
  const blocked=chart.querySelector('[data-bar="blocked"]');
  if(clean)clean.setAttribute('width',preset.clean);
  if(blocked)blocked.setAttribute('width',preset.blocked);
  if(status)status.textContent=preset.text;
 };
 document.querySelectorAll('[data-example]').forEach(button=>{
  button.addEventListener('click',()=>{
   document.querySelectorAll('[data-example]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
   apply(button.dataset.example);
  });
 });
 const pause=document.querySelector('.motion-toggle');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const syncMotion=()=>{if(pause)pause.hidden=motion.matches;};
 syncMotion();
 motion.addEventListener('change',syncMotion);
 pause?.addEventListener('click',()=>{
  const paused=pause.getAttribute('aria-pressed')==='true';
  pause.setAttribute('aria-pressed',String(!paused));
  pause.textContent=paused?'Pause motion':'Resume motion';
  art.classList.toggle('motion-active',paused);
 });
 apply('mixed');
})();
