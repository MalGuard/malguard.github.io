/* Shared interaction layer. No upload, file execution, or security verdict API. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('[data-w]').forEach(h => {
    const lines=h.innerHTML.split(/<br\s*\/?\s*>/i);
    let index=0;
    h.replaceChildren();
    lines.forEach((line,k)=>{
      const tmp=document.createElement('span'); tmp.innerHTML=line;
      tmp.textContent.trim().split(/\s+/).forEach(word=>{
        const s=document.createElement('span');s.className='w';s.textContent=word;
        s.style.transitionDelay=`${index++*.07}s`;h.append(s,document.createTextNode(' '));
      });
      if(k<lines.length-1)h.append(document.createElement('br'));
    });
  });
  // The supplied reference uses a 35% intersection, no root margin, and
  // one-way reveals. Preserve that exact text timing, including on reverse scroll.
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      const target=e.target._mgRevealTarget||e.target;
      if(target.matches('.scene[data-scene="0"]')&&document.body.dataset.intro!=='ready')return;
      if(target.matches('#layers .sticky'))target.classList.add('particle-ready');
      else target.classList.add(target.matches('.scene,.hero')?'in':'show');
    });
  },{threshold:.35});
  document.querySelectorAll('.scene,.hero,.rv,#layers .sticky').forEach(el=>{
    // The additional long Lab / product modules exceed a viewport on phones.
    // Observe their text block with the same reference threshold, not an
    // impossible 35% of a several-screen container.
    const trigger=el.matches('#demo')?el.querySelector('.lab-copy'):
      el.matches('#products')?el.querySelector('.section-top'):el.querySelector('[data-reveal-anchor]')||el;
    trigger._mgRevealTarget=el;io.observe(trigger);
    if(el.querySelector('[data-reveal-anchor]')){
      const body=el.querySelector('.analysis-display,.focus-grid,.local-tool-grid');
      if(body){body._mgRevealTarget=el;io.observe(body);}
    }
    // Direct section entry or keyboard focus can reach the controls before the
    // reading block. Reveal the same module when its real UI reaches the same
    // reference threshold; keep the original transition and one-way timing.
    if(el.matches('#demo')){
      const controls=el.querySelector('#scan');controls._mgRevealTarget=el;io.observe(controls);
      controls.addEventListener('focusin',e=>{
        const target=e.target;
        if(!target.matches('button,a,input,select,textarea'))return;
        requestAnimationFrame(()=>{
          if(document.activeElement!==target)return;
          const safeTop=(document.querySelector('nav')?.getBoundingClientRect().bottom||0)+32,r=target.getBoundingClientRect();
          if(r.top<safeTop&&r.bottom>0)scrollBy({top:r.top-safeTop,behavior:'instant'});
        });
      });
    }
    if(el.matches('#products'))el.querySelectorAll('.card').forEach(card=>{card._mgRevealTarget=el;io.observe(card);});
  });
  // The fingerprint entrance releases the first scene after all points settle.

  document.querySelectorAll('.card').forEach(card=>{
    const tilt=card.querySelector('.card-tilt'),front=card.querySelector('.front'),back=card.querySelector('.back'),link=back.querySelector('a');
    function flip(){const transferFocus=card.contains(document.activeElement);
      const open=card.classList.toggle('flip');
      tilt.style.transform='';card.dataset.flipped=String(open);card.querySelectorAll('.mg-card-control').forEach(b=>b.setAttribute('aria-expanded',String(open)));
      card.setAttribute('aria-label',`${front.querySelector('h3').textContent}: ${open?'hide':'show'} details`);
      front.setAttribute('aria-hidden',String(open));back.setAttribute('aria-hidden',String(!open));
      front.inert=open;back.inert=!open;link.tabIndex=open?0:-1;if(transferFocus)(open?back:front).querySelector('.mg-card-control')?.focus({preventScroll:true});
    }
    card.addEventListener('click',e=>{if(!e.target.closest('a'))flip();});
    card.addEventListener('keydown',e=>{
      if(e.target!==card&&!e.target.matches('.mg-card-control'))return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();flip();}
      if(e.key==='Escape'&&card.classList.contains('flip'))flip();
    });
    card.addEventListener('pointermove',e=>{if(e.target.closest('.mg-card-control,a'))return;
      if(!fine.matches||reduced.matches||document.body.classList.contains('motion-paused')||card.classList.contains('flip'))return;
      const r=card.getBoundingClientRect();
      tilt.style.transform=`rotateY(${((e.clientX-r.left)/r.width-.5)*9}deg) rotateX(${((e.clientY-r.top)/r.height-.5)*-9}deg)`;
    });
    card.addEventListener('pointerleave',()=>tilt.style.transform='');
  });

  const samples=[
    {name:'FastTrainer.asi',size:'412 KB',v:'No scripted indicators',color:'#6be1b1',icon:'◇',nodes:0,detail:'Completed demo checks found no scripted indicators. This invented result makes no claim about any real file. A clean result is never a guarantee.'},
    {name:'vehicle_pack.dll',size:'1.8 MB',v:'Suspicious',color:'#ffc171',icon:'!',nodes:3,detail:'Invented indicators call for closer inspection in this scripted scenario. This is not a finding about a real file.'},
    {name:'loader_x.asi',size:'98 KB',v:'Malicious',color:'#ff7381',icon:'×',nodes:6,detail:'Multiple invented harmful patterns agree in this scripted scenario. This is not a finding about a real file.'},
    {name:'unknown.dll',size:'Unknown',v:'Inconclusive',color:'#b5c4df',icon:'?',nodes:0,detail:'Required evidence is missing in this scripted scenario. Inconclusive must never be interpreted as Safe.'}
  ];
  const picks=document.getElementById('picks'),scan=document.getElementById('scan');
  const vt=document.getElementById('vt'),vd=document.getElementById('vd');
  const steps=[...document.querySelectorAll('#scan-steps span')];
  let timers=[],generation=0;
  function select(i){
    timers.forEach(clearTimeout);timers=[];const gen=++generation,s=samples[i];
    picks.querySelectorAll('button').forEach((b,k)=>{b.classList.toggle('on',k===i);b.setAttribute('aria-pressed',String(k===i));});
    document.getElementById('fname').textContent=s.name;document.getElementById('fsz').textContent=s.size;
    scan.classList.add('run');scan.dataset.verdict='pending';scan.style.setProperty('--verdict-color','#8fcaff');
    vt.style.color='';document.getElementById('verdict-icon').textContent='·';
    window.dispatchEvent(new CustomEvent('mg:scan-start',{detail:s}));
    const messages=['Identifying the sample format…','Inspecting the sample structure…','Analyzing the sample indicators…','Deciding from the available evidence…'];
    function stage(k){
      if(gen!==generation)return;
      steps.forEach((el,n)=>{el.classList.toggle('on',n===k);el.classList.toggle('done',n<k);if(n===k)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
      vt.textContent=['Identify','Inspect','Analyze','Decide'][k];vd.textContent=messages[k];
      window.dispatchEvent(new CustomEvent('mg:scan-stage',{detail:{index:k,name:vt.textContent}}));
    }
    stage(0);
    [1,2,3].forEach(k=>timers.push(setTimeout(()=>stage(k),k*1150)));
    timers.push(setTimeout(()=>{
      if(gen!==generation)return;
      scan.classList.remove('run');scan.dataset.verdict=s.v;
      steps.forEach(el=>{el.classList.remove('on');el.classList.add('done');el.removeAttribute('aria-current');});
      scan.style.setProperty('--verdict-color',s.color);vt.textContent=s.v;vt.style.color=s.color;vd.textContent=s.detail;
      document.getElementById('verdict-icon').textContent=s.icon;
      window.dispatchEvent(new CustomEvent('mg:scan-complete',{detail:s}));
    },4800));
  }
  picks?.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(b)select(Number(b.dataset.i));});

  // Pause is available in addition to the OS reduced-motion preference.
  const pause=document.createElement('button');pause.className='motion-control';pause.type='button';pause.textContent='Pause motion';pause.setAttribute('aria-pressed','false');
  document.body.append(pause);
  pause.addEventListener('click',()=>{
    const paused=document.body.classList.toggle('motion-paused');pause.textContent=paused?'Resume motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));
    document.querySelectorAll('.card-tilt').forEach(el=>el.style.transform='');
    window.dispatchEvent(new CustomEvent('mg:motion',{detail:{paused}}));
  });
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('tab-hidden',document.hidden));
  window.MalGuardDemo={select,samples};
})();
