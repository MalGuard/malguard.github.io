(() => {
 'use strict';const canvas=document.getElementById('secure-field'),host=document.getElementById('secure-volume');if(!canvas||!host)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;const reduced=matchMedia('(prefers-reduced-motion:reduce)');let W=1,H=1,dpr=1,raf=0,last=0,time=0,activity=0,volume=null,dead=false,typingTimer=0;
 const accessGate=document.getElementById('accessGate');
 function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);volume?.resize();paint();}
 function paint(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const compact=W<=900,cx=W*(compact?.5:.27),cy=H*(compact?.36:.58),radius=Math.min(W,H)*(compact?.29:.29),t=time/1000;
  for(let i=0;i<100;i++){const seed=i*2.39996,z=(i%13)/13,angle=seed+t*(.02+z*.015),r=radius*(1.3+z*1.5),x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r*.72;ctx.fillStyle=`rgba(128,193,246,${.07+z*.22})`;ctx.fillRect(x,y,z>.6?1.5:1,z>.6?1.5:1);}
  for(let ring=0;ring<3;ring++){
   ctx.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2+t*(ring%2?-.05:.04),r=radius*(1.15+ring*.24),tilt=.46+ring*.13,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*tilt; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
   ctx.strokeStyle=`rgba(119,176,225,${.035+activity*.02})`;ctx.lineWidth=.6;ctx.stroke();
   const a=t*(.3+ring*.08)+ring*2,r=radius*(1.15+ring*.24),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*(.46+ring*.13);ctx.fillStyle='#9bd9ff';ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(x,y,1.6+activity,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  if(activity>.02){const r=radius*(.5+(t%1.1)*.9);ctx.strokeStyle=`rgba(149,216,255,${activity*.14})`;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(cx,cy,r,r*.64,0,0,Math.PI*2);ctx.stroke();}
  volume?.draw({elapsed:time,open:1,logo:1,scan:(t%9)/9,beam:.18,quantumTurn:t*.055,quantumEnergy:.05+activity*.15,coreEnergy:.03+activity*.15,fragments:0,portalX:compact?.5:.27,portalY:compact?.36:.58});
  canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
 }
 function frame(now){raf=0;if(dead||document.hidden||accessGate?.hidden||reduced.matches||document.body.classList.contains('motion-paused'))return;const delta=last?Math.min(80,now-last):16;last=now;time+=delta;activity*=Math.exp(-delta/700);paint();raf=requestAnimationFrame(frame);}
 function wake(){if(!dead&&!document.hidden&&!accessGate?.hidden&&!reduced.matches&&!document.body.classList.contains('motion-paused')&&!raf){last=0;raf=requestAnimationFrame(frame);canvas.dataset.running='true';}}
 function stop(){cancelAnimationFrame(raf);raf=0;last=0;canvas.dataset.running='false';}
 document.addEventListener('input',e=>{if(!e.target.matches('input,textarea'))return;activity=Math.min(1,activity+.35);document.body.classList.add('is-typing');clearTimeout(typingTimer);typingTimer=setTimeout(()=>document.body.classList.remove('is-typing'),800);});
 for(const input of document.querySelectorAll('[data-password-signal]')){
  const track=document.getElementById(input.dataset.passwordSignal);if(!track)continue;
  input.addEventListener('input',()=>{track.replaceChildren();for(let i=0;i<Math.min(18,input.value.length);i++){const dot=document.createElement('span');dot.textContent='•';dot.style.setProperty('--i',i);track.append(dot);}});
 }
 document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden)wake();});window.addEventListener('mg:motion',e=>{stop();if(!e.detail?.paused)wake();});reduced.addEventListener('change',()=>{stop();paint();wake();});window.addEventListener('resize',resize,{passive:true});
 if(accessGate)new MutationObserver(()=>{stop();if(!accessGate.hidden)wake();}).observe(accessGate,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('pagehide',e=>{stop();if(!e.persisted){dead=true;clearTimeout(typingTimer);volume?.dispose();volume=null;}});window.addEventListener('pageshow',wake);
 if(!reduced.matches)try{volume=window.createMalGuardHomeProjection?.(host,{lite:true});}catch{}
 resize();wake();
})();
