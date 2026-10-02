/* MalGuard motion: reversible DOM interactions, bounded canvas work, native scrolling. */
(() => {
  'use strict';
  if (!document.body.classList.contains('mg-home')) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const paused = () => reduced.matches || root.classList.contains('motion-paused');
  const scene = document.getElementById('securityScene');
  const shield = document.getElementById('openCore');
  const details = document.getElementById('coreDetails');
  let shieldOpen = false;
  function setShield(open) {
    shieldOpen = open;
    scene.classList.toggle('core-open', open);
    shield.setAttribute('aria-expanded', String(open));
    shield.setAttribute('aria-label', open ? 'Close the MalGuard shield' : 'Open the MalGuard shield');
    details.setAttribute('aria-hidden', String(!open));
    details.inert = !open;
    document.getElementById('coreHint').textContent = open ? 'Tap again to close ↙︎' : 'Tap the shield to open ↗︎';
  }
  shield.addEventListener('click', () => setShield(!shieldOpen));
  shield.addEventListener('pointermove', e => {
    if (paused() || !fine.matches || shieldOpen) return;
    const box = shield.getBoundingClientRect();
    shield.style.setProperty('--shield-tilt', ((e.clientX - box.left) / box.width - .5) * 18 + 'deg');
  });
  shield.addEventListener('pointerleave', () => shield.style.removeProperty('--shield-tilt'));
  const cards = [...document.querySelectorAll('.orbit-product')];
  function turnCard(card, open, focus = true) {
    const front = card.querySelector('.product-front');
    const back = card.querySelector('.product-back');
    const trigger = front.querySelector('[data-product-inspect]');
    card.classList.toggle('is-flipped', open);
    trigger.setAttribute('aria-expanded', String(open));
    // Move focus before hiding its previous face from the accessibility tree.
    front.inert = open;
    back.inert = !open;
    if (focus) (open ? back.querySelector('.product-return') : trigger).focus({ preventScroll: true });
    front.setAttribute('aria-hidden', String(open));
    back.setAttribute('aria-hidden', String(!open));
  }
  cards.forEach((card, i) => {
    card.style.setProperty('--reveal-order', String(i));
    const title = card.querySelector('h3').textContent;
    const trigger = card.querySelector('[data-product-inspect]');
    trigger.setAttribute('aria-label', 'Turn to explore ' + title);
    trigger.addEventListener('click', () => turnCard(card, true));
    card.querySelector('.product-return').addEventListener('click', () => turnCard(card, false));
    card.addEventListener('click', e => {
      if (e.target.closest('a,button') || getSelection()?.toString()) return;
      turnCard(card, !card.classList.contains('is-flipped'));
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const card = document.activeElement?.closest('.orbit-product.is-flipped');
    if (card) turnCard(card, false);
    if (shieldOpen && scene.contains(document.activeElement)) { setShield(false); shield.focus({ preventScroll: true }); }
  });

  const stack = document.querySelector('.analysis-stack');
  const stackToggle = document.getElementById('stackToggle');
  const steps = [...document.querySelectorAll('.orbit-step')];
  let stackTouched = false;
  function spread(open) {
    stack.classList.toggle('is-spread', open);
    stackToggle.setAttribute('aria-pressed', String(open));
    stackToggle.innerHTML = open ? 'Gather layers <span aria-hidden="true">↙︎</span>' : 'Separate layers <span aria-hidden="true">↗︎</span>';
  }
  stackToggle.addEventListener('click', () => { stackTouched = true; spread(!stack.classList.contains('is-spread')); });
  steps.forEach((step, i) => step.addEventListener('toggle', () => {
    if (!step.open) return;
    steps.forEach(other => { if (other !== step) other.open = false; });
    stack.querySelectorAll('.stack-plane').forEach(plane => plane.classList.toggle('is-active', Number(plane.dataset.plane) === i));
    // Native details dispatch an initial toggle for their HTML open attribute.
    if (i !== 0 || stackTouched) { stackTouched = true; spread(true); }
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('motion-outside', !entry.isIntersecting);
      if (entry.target === stack && entry.isIntersecting && !stackTouched && !paused()) spread(true);
    }), { threshold: .06 });
    [scene, stack, ...cards].forEach(el => observer.observe(el));
  }
  const progress = document.createElement('div');
  progress.className = 'scroll-reading-line'; progress.setAttribute('aria-hidden', 'true'); document.body.append(progress);
  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const length = root.scrollHeight - root.clientHeight;
    progress.style.transform = 'scaleX(' + (length ? Math.max(0, Math.min(1, scrollY / length)) : 0) + ')';
  }
  const scheduleProgress = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); };
  addEventListener('scroll', scheduleProgress, { passive: true });
  addEventListener('resize', scheduleProgress);
  new ResizeObserver(scheduleProgress).observe(document.body);
  updateProgress();

  // Cinematic background: the canvas is the story, not decorative confetti.
  // Six deterministic particle scenes are interpolated by the viewport center:
  // portal -> data column -> scan river -> horizon -> black hole -> galaxy.
  const canvas = document.getElementById('networkField');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const sceneEls = [...document.querySelectorAll('[data-cinematic-scene]')];
  const TAU = Math.PI * 2;
  const running = () => !paused() && !document.hidden && !document.body.classList.contains('site-entry-locked');
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const smooth = t => t*t*(3-2*t);
  const lerp = (a,b,t) => a+(b-a)*t;

  function seeded(seed) {
    let x = seed >>> 0;
    return () => {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const random = seeded(0x4d474152);
  let width=0,height=0,dpr=1,frame=0,last=0,time=0,frames=0;
  let pointerX=0,pointerY=0,targetX=0,targetY=0;
  let scrollVelocity=0,lastScroll=scrollY;
  let count=0,activeCount=0,targets=[],seeds=new Float32Array(0),stars=[];
  let scenePos=0,qualitySamples=0,qualityTotal=0;
  let glowSprite=null;

  const palettes = [
    [[104,188,255],[255,120,211]], // portal: blue to magenta rim
    [[77,155,255],[126,231,255]], // data column
    [[71,137,255],[150,109,255]], // scan river
    [[88,173,255],[255,146,201]], // horizon
    [[95,148,255],[255,113,180]], // black hole
    [[118,151,255],[255,184,235]] // final galaxy
  ];

  function makeGlow() {
    const c=document.createElement('canvas');c.width=c.height=64;
    const g=c.getContext('2d');
    const r=g.createRadialGradient(32,32,0,32,32,32);
    r.addColorStop(0,'rgba(255,255,255,1)');
    r.addColorStop(.14,'rgba(190,223,255,.95)');
    r.addColorStop(.42,'rgba(84,142,255,.28)');
    r.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=r;g.fillRect(0,0,64,64);
    return c;
  }

  function setPoint(arr,i,x,y,z){
    const j=i*3;arr[j]=x;arr[j+1]=y;arr[j+2]=z;
  }

  function buildTargets(n) {
    const out=Array.from({length:6},()=>new Float32Array(n*3));
    for(let i=0;i<n;i++){
      const u=i/n;

      // 0: elliptical plasma portal, with a slightly ragged luminous edge.
      let a=random()*TAU;
      let rr=2.05+Math.sin(a*13)*.11+(random()-.5)*(.18+(i%19===0?.55:0));
      setPoint(out[0],i,Math.cos(a)*rr,Math.sin(a)*rr*.84,(random()-.5)*.72);

      // 1: tall double data stream. Narrow center, wider ends.
      const hy=(random()-.5)*6.2;
      const strand=i%2?Math.PI:0;
      const radius=.5+.18*Math.abs(hy)/3.1+.08*Math.sin(hy*1.1)+(random()-.5)*.08;
      const ha=hy*2.15+strand;
      setPoint(out[1],i,Math.cos(ha)*radius,hy,Math.sin(ha)*radius+(random()-.5)*.1);

      // 2: broad star river / scan surface.
      const gx=(random()-.5)*8.4,gz=(random()-.5)*4.7;
      const gy=Math.sin(gx*.72+gz*.44)*.36+Math.cos(gz*1.35)*.18-.28;
      setPoint(out[2],i,gx,gy,gz);

      // 3: planetary horizon / orbital stream.
      if(i%5===0){
        const ha2=(random()-.5)*5.4;
        setPoint(out[3],i,ha2,-.7-.11*Math.cos(ha2*.8),(random()-.5)*.9);
      }else{
        const d=.75+Math.pow(random(),.72)*3.8;
        const q=random()*TAU+d*.58;
        setPoint(out[3],i,Math.cos(q)*d,(random()-.5)*.18-.32,Math.sin(q)*d);
      }

      // 4: black-hole accretion disk. Dense core, thin vertical thickness.
      const bd=.3+Math.pow(random(),.56)*4.2;
      const ba=random()*TAU+bd*.78;
      const thickness=(random()-.5)*.16/(bd*.28+.3);
      setPoint(out[4],i,Math.cos(ba)*bd,thickness,Math.sin(ba)*bd);

      // 5: three-arm galaxy, calm finale.
      const arm=i%3;
      const gd=.08+Math.pow(random(),1.62)*4.05;
      const ga=gd*1.04+arm*TAU/3+(random()-.5)*.56/(gd*.28+.45);
      const gy2=(random()-.5)*.34*Math.max(.18,1-gd/4.3);
      setPoint(out[5],i,Math.cos(ga)*gd,gy2,Math.sin(ga)*gd);
    }
    return out;
  }

  function buildStars(n){
    return Array.from({length:n},()=>({
      x:random(), y:random(), z:.25+random()*.75,
      size:.35+random()*1.25, phase:random()*TAU
    }));
  }

  function measureScenes(){
    if(!sceneEls.length) return [];
    return sceneEls.map(el=>el.offsetTop+el.offsetHeight*.52);
  }

  function storyPosition(){
    const anchors=measureScenes();
    if(anchors.length<2) return clamp(scrollY/(Math.max(1,root.scrollHeight-innerHeight))*5,0,5);
    const probe=scrollY+innerHeight*.54;
    if(probe<=anchors[0]) return 0;
    for(let i=0;i<anchors.length-1;i++){
      if(probe<=anchors[i+1]){
        const t=clamp((probe-anchors[i])/(anchors[i+1]-anchors[i]),0,1);
        return i+smooth(t);
      }
    }
    return Math.min(5,anchors.length-1);
  }

  function sceneColor(scene,t,seed){
    const a=palettes[scene],b=palettes[Math.min(5,scene+1)];
    const mix=(p0,p1)=>[
      lerp(p0[0],p1[0],t),
      lerp(p0[1],p1[1],t),
      lerp(p0[2],p1[2],t)
    ];
    const lo=mix(a[0],b[0]),hi=mix(a[1],b[1]);
    const c=seed<.78?lo:hi;
    return c;
  }

  function draw(){
    const now=performance.now();
    ctx.clearRect(0,0,width,height);

    // Deep-space wash and vignette. The canvas stays readable behind copy.
    const haze=ctx.createRadialGradient(width*.5,height*.46,0,width*.5,height*.46,Math.max(width,height)*.72);
    haze.addColorStop(0,'rgba(16,28,68,.16)');
    haze.addColorStop(.48,'rgba(4,8,24,.08)');
    haze.addColorStop(1,'rgba(1,2,8,0)');
    ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);

    // Starfield: almost static, only tiny parallax and twinkle.
    for(const s of stars){
      const sx=((s.x*width + pointerX*s.z*1.4)%width+width)%width;
      const sy=((s.y*height - scrollY*.006*s.z + pointerY*s.z)%height+height)%height;
      const tw=.72+.28*Math.sin(time*.7+s.phase);
      ctx.fillStyle='rgba(164,194,255,'+(.13+s.z*.27)*tw+')';
      ctx.fillRect(sx,sy,s.size,s.size);
    }

    const targetStory=storyPosition();
    scenePos += (targetStory-scenePos)*(paused()?.2:.065);
    const f=clamp(scenePos,0,5);
    const s0=Math.min(4,Math.floor(f));
    const local=smooth(f-s0);
    const A=targets[s0],B=targets[s0+1];

    // Camera language follows the reference: ring/front, column/front,
    // river/horizon tilt, then orbital discs and galaxy.
    const tilts=[.04,.02,.78,1.02,1.16,.9];
    const zooms=[1.05,1.02,.92,.98,1.02,.96];
    const offsetsX=[.17,-.12,.06,-.13,.12,0];
    const offsetsY=[-.02,0,.11,.08,.01,.03];
    const tilt=lerp(tilts[s0],tilts[s0+1],local)+pointerY*.0022;
    const ct=Math.cos(tilt),st=Math.sin(tilt);
    const zoom=lerp(zooms[s0],zooms[s0+1],local);
    const ox=lerp(offsetsX[s0],offsetsX[s0+1],local);
    const oy=lerp(offsetsY[s0],offsetsY[s0+1],local);
    const spin=time*.032+pointerX*.0014+scrollVelocity*.00042;
    const cs=Math.cos(spin),ss=Math.sin(spin);
    const scale=Math.min(width,height)*(width<640?.22:.255)*zoom;
    const cx=width*(.5+ox*(width<760?0:.42));
    const cy=height*(.48+oy);
    const transitionEnergy=Math.sin(local*Math.PI);

    ctx.globalCompositeOperation='lighter';
    const limit=Math.min(activeCount,count);
    for(let i=0;i<limit;i++){
      const j=i*3,seed=seeds[i];
      const stagger=clamp(local*1.42-seed*.42,0,1);
      const e=smooth(stagger);
      let x=lerp(A[j],B[j],e);
      let y=lerp(A[j+1],B[j+1],e);
      let z=lerp(A[j+2],B[j+2],e);

      // Slow vortex only during scene changes. Idle motion stays calm.
      const swirl=transitionEnergy*(seed-.5)*.34;
      x+=Math.cos(seed*31+time*.16)*swirl;
      y+=Math.sin(seed*19+time*.12)*swirl*.5;

      const X=x*cs-z*ss;
      const Z0=x*ss+z*cs;
      const Y=y*ct-Z0*st;
      const Z=y*st+Z0*ct;
      const k=5.2/(5.55+Z);
      if(k<=0) continue;
      const px=cx+(X+pointerX*.0009)*scale*k;
      const py=cy+(Y+pointerY*.0007)*scale*k;
      if(px<-30||py<-30||px>width+30||py>height+30) continue;

      const color=sceneColor(s0,e,seed);
      const alpha=clamp(.16+k*.28,0,.72);
      const size=Math.max(.65,.75+k*.92+(i%43===0?.8:0));
      ctx.fillStyle='rgba('+color[0].toFixed(0)+','+color[1].toFixed(0)+','+color[2].toFixed(0)+','+alpha.toFixed(3)+')';
      ctx.fillRect(px,py,size,size);

      // Sparse bloom points create the luminous photographic feel without blur filters.
      if(i%29===0){
        const gs=10+size*9;
        ctx.globalAlpha=alpha*.72;
        ctx.drawImage(glowSprite,px-gs/2,py-gs/2,gs,gs);
        ctx.globalAlpha=1;
      }
    }
    ctx.globalCompositeOperation='source-over';

    frames++;
    root.dataset.networkFrames=String(frames);
    root.dataset.cinematicScene=String(Math.round(f));

    // Quality adapts only downward and only after sustained slow frames.
    const cost=performance.now()-now;
    qualityTotal+=cost;qualitySamples++;
    if(qualitySamples>=50){
      const avg=qualityTotal/qualitySamples;
      if(avg>25&&activeCount>900) activeCount=Math.max(900,Math.floor(activeCount*.78));
      qualitySamples=qualityTotal=0;
      root.dataset.cinematicParticles=String(activeCount);
    }
  }

  function tick(now){
    frame=0;
    if(!running()) return;
    if(now-last>=32){
      const dt=Math.min(64,now-last);
      time+=dt/1000;
      const current=scrollY;
      scrollVelocity=scrollVelocity*.86+(current-lastScroll)*.14;
      lastScroll=current;
      pointerX+=(targetX-pointerX)*.035;
      pointerY+=(targetY-pointerY)*.035;
      last=now;
      draw();
    }
    frame=requestAnimationFrame(tick);
  }

  function sync(){
    cancelAnimationFrame(frame);frame=0;last=performance.now();lastScroll=scrollY;
    if(paused()){pointerX=pointerY=targetX=targetY=0;scrollVelocity=0;shield.style.removeProperty('--shield-tilt');}
    draw();
    if(running()) frame=requestAnimationFrame(tick);
  }

  function resize(){
    width=innerWidth;height=innerHeight;
    dpr=Math.min(devicePixelRatio||1,width<640?1.15:1.4);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    count=width<640?1450:width<1000?2050:2850;
    activeCount=count;
    targets=buildTargets(count);
    seeds=new Float32Array(count);
    for(let i=0;i<count;i++) seeds[i]=random();
    stars=buildStars(width<640?95:170);
    glowSprite=makeGlow();
    root.dataset.networkPoints=String(count);
    root.dataset.cinematicParticles=String(activeCount);
    sync();
  }

  addEventListener('pointermove',e=>{
    if(paused()||!fine.matches) return;
    targetX=(e.clientX-width*.5)*.14;
    targetY=(e.clientY-height*.5)*.10;
  },{passive:true});
  addEventListener('scroll',()=>{
    const current=scrollY;
    scrollVelocity=scrollVelocity*.82+(current-lastScroll)*.18;
    lastScroll=current;
  },{passive:true});
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',sync);
  addEventListener('malguard-motion',sync);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  resize();
  root.dataset.collectionReady = 'true';
})();
