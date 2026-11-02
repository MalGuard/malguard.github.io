/* Presentation only: reference transitions and a crank/slider mechanical illustration. */
(()=>{
 const host=document.querySelector('.brand-orbit');if(!host)return;
 const requested=new URLSearchParams(location.search).get('motion');
 const mode=['merge','orbit','engine'].includes(requested)?requested:'orbit';host.dataset.mode=mode;
 const captions={merge:'Your tools. One MalGuard.',orbit:'Your tools. Connected by MalGuard.',engine:'Link. File. AI. Agent. Working in rhythm.'};
 host.querySelector('figcaption').textContent=captions[mode];
 const button=host.querySelector('.orbit-control'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let mechanical=[],finished=false;
 function syncMechanical(){const pause=reduce.matches||document.hidden||host.classList.contains('is-paused')||host.classList.contains('is-offscreen');mechanical.forEach(a=>pause?a.pause():a.play());}
 function createMechanical(){
  if(mode!=='engine'||reduce.matches||mechanical.length)return;
  const piston=[],rod=[],crank=[],intake=[],exhaust=[],intakeSpring=[],exhaustSpring=[],charge=[],gas=[];
  for(let i=0;i<=120;i++){
   const angle=i/120*Math.PI*2+Math.PI,pinX=-17*Math.sin(angle),pinY=150+17*Math.cos(angle);
   const sliderY=pinY-Math.sqrt(58*58-pinX*pinX),rodAngle=-Math.atan2(pinX,pinY-sliderY)*180/Math.PI;
   piston.push({transform:`translateY(${sliderY}px)`});rod.push({transform:`translateY(${sliderY}px) rotate(${rodAngle}deg)`});crank.push({transform:`rotate(${180+i/120*360}deg)`});
   const cycle=i/120*Math.PI*4;
   const inlet=cycle<Math.PI?Math.sin(cycle)*5:0,outlet=cycle>Math.PI*3?Math.sin(cycle-Math.PI*3)*5:0;
   intake.push({transform:`translateY(${inlet}px)`});exhaust.push({transform:`translateY(${outlet}px)`});
   intakeSpring.push({transform:`scaleY(${1-inlet/12})`});exhaustSpring.push({transform:`scaleY(${1-outlet/12})`});
   charge.push({transform:`translateY(45px) scaleY(${sliderY-53})`});
   const stroke=cycle/Math.PI;
   let fill='rgba(114,192,239,.18)';
   if(stroke>=1&&stroke<2)fill=`rgba(184,211,234,${.15+(stroke-1)*.17})`;
   else if(stroke>=2&&stroke<3)fill=`rgba(246,165,83,${.06+.43*Math.exp(-(stroke-2)*2.8)})`;
   else if(stroke>=3)fill=`rgba(157,168,192,${.12-(stroke-3)*.06})`;
   gas.push({fill});
  }
  host.querySelectorAll('.motor-unit').forEach((unit,i)=>{
   const options={duration:2600,iterations:Infinity,delay:-i*650,fill:'both'};
   [['.motor-piston',piston],['.motor-rod',rod],['.motor-crank',crank],['.motor-combustion',charge]].forEach(([selector,frames])=>mechanical.push(unit.querySelector(selector).animate(frames,options)));
   [['.motor-intake',intake],['.motor-exhaust',exhaust],['.motor-intake-spring',intakeSpring],['.motor-exhaust-spring',exhaustSpring],['.motor-gas',gas]].forEach(([selector,frames])=>mechanical.push(unit.querySelector(selector).animate(frames,{...options,duration:5200})));
  });syncMechanical();
 }
 function replay(){
  finished=false;host.getAnimations({subtree:true}).forEach(a=>a.cancel());host.classList.remove('is-paused');
  host.querySelectorAll('*').forEach(n=>{n.style.animation='none';});void host.offsetWidth;
  host.querySelectorAll('*').forEach(n=>{n.style.animation='';});button.textContent='Pause animation';button.setAttribute('aria-pressed','false');
 }
 button.addEventListener('click',()=>{
  if(mode==='merge'&&finished){replay();return;}
  const paused=host.classList.toggle('is-paused');button.textContent=paused?'Resume animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));syncMechanical();
 });
 host.querySelector('.orbit-path').addEventListener('animationend',e=>{if(mode==='merge'&&e.animationName==='reference-orbit-exit'){finished=true;button.textContent='Replay animation';button.setAttribute('aria-pressed','false');}});
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{host.classList.toggle('is-offscreen',!entries[0].isIntersecting);syncMechanical();},{threshold:0}).observe(host);
 document.addEventListener('visibilitychange',()=>{host.classList.toggle('is-tab-hidden',document.hidden);syncMechanical();});
 reduce.addEventListener('change',()=>{if(reduce.matches){mechanical.forEach(a=>a.cancel());mechanical=[];host.classList.remove('is-paused');}else createMechanical();syncMechanical();});
 host.dataset.orbitReady='true';createMechanical();
})();
