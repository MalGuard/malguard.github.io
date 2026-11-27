/* CSS-3D lab, rebuilt from the supplied 3D Lab reference. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const cube=$('cube'),tilt=$('tilt'),stage=document.querySelector('.stage'),nodes=$('nodes');
  let seed=14231;
  function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  const faces=[...document.querySelectorAll('.f')];
  function hex(k){let s=['MG : SAMPLE / '+('0'+(k+1)).slice(-2),'FORMAT  PE / x64','----------------------'].join('\n')+'\n';for(let r=0;r<9;r++){for(let c=0;c<7;c++)s+=(random()*256|0).toString(16).padStart(2,'0')+' ';s+='\n';}return s;}
  faces.forEach((f,k)=>f.textContent=hex(k));
  const mq=$('mq');const copy=mq.cloneNode(true);[...copy.children].forEach(c=>mq.append(c));
  const heroObserver=new IntersectionObserver(es=>{
    es.forEach(e=>{document.body.classList.toggle('lab-visible',e.isIntersecting);});
  },{threshold:0});heroObserver.observe(document.querySelector('.hero'));
  setInterval(()=>{
    if(reduced.matches||document.hidden||document.body.classList.contains('motion-paused')||!document.body.classList.contains('lab-visible'))return;
    const k=random()*6|0;faces[k].textContent=hex(k);
  },1100);
  window.addEventListener('mg:scan-start',()=>{
    cube.classList.remove('show','inc');cube.classList.add('run');cube.style.setProperty('--c','#8fcaff');nodes.replaceChildren();$('chamber-status').textContent='IDENTIFY';document.querySelector('.chamber-meter i').style.width='12%';
  });
  window.addEventListener('mg:scan-stage',e=>{
    $('chamber-status').textContent=e.detail.name.toUpperCase();document.querySelector('.chamber-meter i').style.width=String((['Identify','Inspect','Analyze','Decide'].indexOf(e.detail.name)+1)*23)+'%';
    faces.forEach((f,k)=>f.textContent=hex(k).replace('FORMAT  PE / x64',e.detail.name.toUpperCase().padEnd(8)+' / DEMO'));
  });
  window.addEventListener('mg:scan-complete',e=>{
    const s=e.detail;cube.classList.remove('run');cube.style.setProperty('--c',s.color);cube.classList.toggle('inc',s.v==='Inconclusive');
    for(let k=0;k<s.nodes;k++){
      const d=document.createElement('div');d.className='node';const size=$('sc3').offsetWidth*.32;
      d.style.transform=`translate3d(${(random()-.5)*size*2}px,${(random()-.5)*size*2}px,${(random()-.5)*size*2}px)`;nodes.append(d);
    }
    cube.classList.add('show');$('chamber-status').textContent=s.v.toUpperCase();$('chamber-verdict').textContent=s.v;document.querySelector('.chamber-meter i').style.width='100%';
  });
  stage.addEventListener('pointermove',e=>{
    if(!fine.matches||reduced.matches||document.body.classList.contains('motion-paused'))return;
    const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    tilt.style.transform=`rotateY(${x*15}deg) rotateX(${-y*12}deg)`;
    $("sc3").style.setProperty("--camera-y",`${x*15}deg`);$("sc3").style.setProperty("--camera-x",`${-y*12}deg`);
  });
  function resetCamera(){tilt.style.transform='';$('sc3').style.setProperty('--camera-y','0deg');$('sc3').style.setProperty('--camera-x','0deg');}
  stage.addEventListener('pointerleave',resetCamera);
  window.addEventListener('mg:motion',resetCamera);
  const layers=$('layers'),stack=$('stack'),slabs=[...document.querySelectorAll('.slab')],steps=[...document.querySelectorAll('.st')],progress=[...document.querySelectorAll('.layer-progress i')];
  let scheduled=false,last=-1;
  function update(){
    scheduled=false;
    const r=layers.getBoundingClientRect(),h=document.querySelector('.sticky').offsetHeight;
    const p=Math.max(0,Math.min(1,(layers.classList.contains("flow-mode")?innerHeight*.35-r.top:-r.top)/Math.max(1,r.height-(layers.classList.contains("flow-mode")?innerHeight*.5:h))));
    stack.style.setProperty('--p',reduced.matches?'.5':p.toFixed(5));
    // Apply the camera to each plane; this avoids Safari flattening nested 3D groups.
    const q=reduced.matches?.5:p,small=innerWidth<=600,gap=small?12+q*27:16+q*58;
    slabs.forEach((s,i)=>{s.style.transform=`perspective(1300px) rotateX(${58-q*10}deg) rotateZ(${-32+q*24}deg) translateZ(${(1.5-i)*gap}px) translateY(${reduced.matches?0:Math.sin(q*Math.PI)*-9+Math.sin(q*Math.PI*4-i*.7)*5}px) translateX(${reduced.matches?0:Math.sin(q*Math.PI*2+i*.6)*6}px)`;s.style.zIndex=String(4-i);});
    const k=Math.min(3,Math.floor(p*4));layers.dataset.activeLayer=String(k);
    if(k!==last){last=k;slabs.forEach((s,i)=>s.classList.toggle('act',i===k));steps.forEach((s,i)=>s.classList.toggle('act',i===k));progress.forEach((s,i)=>s.classList.toggle('active',i<=k));$('layer-count').textContent='0'+(k+1);}
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  function fit(){layers.classList.toggle('flow-mode',innerHeight<360||reduced.matches);schedule();}addEventListener('scroll',schedule,{passive:true});addEventListener('resize',fit);document.fonts.ready.then(fit);fit();reduced.addEventListener('change',schedule);update();
})();
