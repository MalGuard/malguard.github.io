/* Hero telemetry HUD. Vector only: no canvas, WebGL, or network. */
(()=>{
 'use strict';
 const art=document.querySelector('.security-art');
 const chart=document.querySelector('.telemetry-chart');
 const status=document.querySelector('.demo-status');
 if(!art||!chart)return;
 const floor=' L604,304 L36,304 Z';
 const scenes={
  mixed:{
   clean:'M36,228 C100,210 140,156 200,148 C260,140 300,176 360,138 C430,92 500,124 604,108',
   blocked:'M36,250 C110,246 160,230 230,236 C300,242 360,214 430,224 C500,234 550,206 604,214',
   pulse:[604,108],
   kpis:['Example input','Local review','No execution'],
   text:'Mixed illustration · sample signals only'
  },
  clean:{
   clean:'M36,176 C110,150 160,118 230,108 C310,96 360,132 430,96 C500,60 550,84 604,68',
   blocked:'M36,274 C140,270 220,262 320,266 C420,270 510,256 604,260',
   pulse:[604,68],
   kpis:['Clean sample','Local review','No execution'],
   text:'Clean-only illustration · no files analyzed'
  },
  risky:{
   clean:'M36,268 C140,262 240,250 340,254 C440,258 520,244 604,248',
   blocked:'M36,198 C100,160 160,124 230,118 C310,110 370,156 450,108 C510,74 560,92 604,80',
   pulse:[604,248],
   kpis:['Risky sample','Local review','No execution'],
   text:'Risky-only illustration · no files analyzed'
  }
 };
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let typing=0;
 function writeStatus(text){
  if(!status)return;
  ++typing;
  status.querySelector('.type-ink')?.remove();
  let source=status.querySelector('.type-source');
  if(!source){source=document.createElement('span');source.className='type-source';status.replaceChildren(source);}
  source.textContent=text;
  status.dataset.typeState='complete';
 }

 const apply=(name,announce)=>{
  const scene=scenes[name]||scenes.mixed;
  art.dataset.verdict=name==='risky'?'flagged':name==='clean'?'clean':'mixed';
  const clean=chart.querySelector('[data-series="clean"]');
  const blocked=chart.querySelector('[data-series="blocked"]');
  const cleanFill=chart.querySelector('[data-series="clean-fill"]');
  const blockedFill=chart.querySelector('[data-series="blocked-fill"]');
  if(clean)clean.setAttribute('d',scene.clean);
  if(blocked)blocked.setAttribute('d',scene.blocked);
  if(cleanFill)cleanFill.setAttribute('d',scene.clean+floor);
  if(blockedFill)blockedFill.setAttribute('d',scene.blocked+floor);
  const pulse=chart.querySelector('[data-pulse]');
  if(pulse){pulse.setAttribute('cx',String(scene.pulse[0]));pulse.setAttribute('cy',String(scene.pulse[1]));}
  chart.querySelectorAll('[data-kpi]').forEach((node,i)=>{if(scene.kpis[i])node.textContent=scene.kpis[i];});
  if(announce)writeStatus(scene.text);
 };
 document.querySelectorAll('[data-example]').forEach(button=>{
  button.addEventListener('click',()=>{
   document.querySelectorAll('[data-example]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
   apply(button.dataset.example,true);
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
})();
