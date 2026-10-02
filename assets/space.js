/* MalGuard space flight: Canvas 2D, hand-written perspective, adaptive quality. */
(() => {
  'use strict';
  if (!document.body.classList.contains('mg-home')) return;
  const root = document.documentElement;
  root.classList.add('space-js');
  const flight = document.getElementById('spaceFlight');
  const stage = document.getElementById('spaceStage');
  const canvas = document.getElementById('spaceCanvas');
  const shieldImage = document.getElementById('spaceShieldSprite');
  const shieldButton = document.getElementById('openCore');
  const coreDetails = document.getElementById('coreDetails');
  const hint = document.getElementById('spaceHint');
  const scanLabel = document.getElementById('spaceScanLabel');
  const cards = [...document.querySelectorAll('[data-space-station]')];
  const dots = [...document.querySelectorAll('[data-space-dot]')];
  if (!flight || !stage || !canvas || !cards.length) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const N = cards.length - 1;
  const ACCENT = '#d0ff8d';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const smooth = t => t * t * (3 - 2 * t);
  const len3 = v => Math.hypot(v[0], v[1], v[2]) || 1;
  const norm3 = v => { const m = len3(v); return [v[0] / m, v[1] / m, v[2] / m]; };
  let seed = 0x4d474152;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const between = (a, b) => a + rnd() * (b - a);

  const planets = [
    { p:[955, -35, 805], r:150, name:'GTA Guard', c:['#dfe8cf','#6b7a52','#161c10'], ring:'rgba(208,255,141,.5)' },
    { p:[-1402, 85, 1047], r:190, name:'Malware AI', c:['#bcd4ff','#3f6fd0','#0b1838'], ring:'rgba(170,200,255,.42)' },
    { p:[-1105, 100, -1960], r:145, name:'Game Scam Guard', c:['#b8f3e8','#23978c','#06282a'], ring:'rgba(160,245,230,.4)' }
  ];
  const stationCamera = i => {
    if (i === 0) return { p:[0,230,1750], l:[-320,0,0] };
    if (i === 1) return { p:[360,65,1080], l:[0,0,100] };
    if (i === 2) return { p:[-470,110,520], l:[0,0,0] };
    if (i >= 3 && i <= 5) {
      const q = planets[i - 3], d = norm3(q.p), t = [-d[2],0,d[0]], side = i === 4 ? 1 : -1;
      return { p:[q.p[0] + d[0] * q.r * 4.4, q.p[1] + q.r * .9, q.p[2] + d[2] * q.r * 4.4], l:[q.p[0] + t[0] * q.r * 1.25 * side, q.p[1], q.p[2] + t[2] * q.r * 1.25 * side] };
    }
    return { p:[0,155,900], l:[-250,0,0] };
  };

  function sprite(size, paint) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    paint(c.getContext('2d'), size); return c;
  }
  const bgSprite = sprite(512, (g, s) => {
    g.fillStyle = '#05080d'; g.fillRect(0,0,s,s);
    const r = g.createRadialGradient(s*.3,s*.28,0,s*.3,s*.28,s*.58);
    r.addColorStop(0,'rgba(26,50,90,.22)'); r.addColorStop(1,'rgba(5,8,13,0)');
    g.fillStyle = r; g.fillRect(0,0,s,s);
  });
  const coreGlow = sprite(256, (g, s) => {
    const r = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    r.addColorStop(0,'rgba(208,255,141,.34)'); r.addColorStop(.32,'rgba(208,255,141,.09)'); r.addColorStop(1,'rgba(208,255,141,0)');
    g.fillStyle = r; g.fillRect(0,0,s,s);
  });
  function planetSprite(colors) {
    return sprite(256, (g, s) => {
      const r = g.createRadialGradient(s*.35,s*.33,s*.02,s/2,s/2,s*.5);
      r.addColorStop(0,colors[0]); r.addColorStop(.54,colors[1]); r.addColorStop(1,colors[2]);
      g.beginPath(); g.arc(s/2,s/2,s*.49,0,Math.PI*2); g.fillStyle=r; g.fill();
      g.lineWidth=3; g.strokeStyle='rgba(255,255,255,.13)'; g.stroke();
    });
  }
  planets.forEach(p => p.sprite = planetSprite(p.c));

  const stars = Array.from({ length:260 }, () => {
    const u=between(0,Math.PI*2), w=Math.acos(between(-1,1)), d=between(2800,6900);
    return [d*Math.sin(w)*Math.cos(u), d*Math.cos(w), d*Math.sin(w)*Math.sin(u), between(.55,1.35)];
  });
  const fileNames=['mod.dll','menu.asi','car.ytd','setup.exe','script.lua','map.ymap','skin.ydd','patch.rpf'];
  const files = Array.from({ length:26 }, (_, i) => {
    const a=between(0,Math.PI*2), rr=between(560,820);
    return { x:Math.cos(a)*rr, y:between(-90,90), z:Math.sin(a)*rr, s:between(24,40), rot:between(-.8,.8), scanned:false, name:fileNames[i%fileNames.length], hash:Math.floor(rnd()*0xffffff).toString(16).padStart(6,'0') };
  });

  let W=innerWidth,H=innerHeight,DPR=1,F=900,flightTop=0,range=1;
  let lowQuality=false, ema=16, slowFrames=0, frames=0;
  let cameraT=0, targetT=0, active=-1, raf=0, last=0, prevBasis=null, prevPos=null, commanded=null;
  let shieldOpen=false, pulse=null, highlighted=null, pointerDown=null;
  const paused = () => reduced.matches || root.classList.contains('motion-paused') || document.hidden || document.body.classList.contains('site-entry-locked');

  function basis(pos, look) {
    const f=norm3([look[0]-pos[0],look[1]-pos[1],look[2]-pos[2]]);
    let r=norm3([-f[2],0,f[0]]);
    if (!Number.isFinite(r[0])) r=[1,0,0];
    const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
    return { p:pos, f, r, u };
  }
  function project(x,y,z,b) {
    const dx=x-b.p[0],dy=y-b.p[1],dz=z-b.p[2];
    const d=dx*b.f[0]+dy*b.f[1]+dz*b.f[2];
    if (d < 10) return null;
    return { x:(dx*b.r[0]+dy*b.r[1]+dz*b.r[2])/d*F+W/2, y:-(dx*b.u[0]+dy*b.u[1]+dz*b.u[2])/d*F+H/2, d, s:F/d };
  }
  function currentCamera(t) {
    if (t >= N) return stationCamera(N);
    const i=Math.floor(t), f=smooth(t-i), a=stationCamera(i), b=stationCamera(Math.min(N,i+1));
    return { p:mix3(a.p,b.p,f), l:mix3(a.l,b.l,f) };
  }
  function syncScrollGeometry() {
    const rect=flight.getBoundingClientRect();
    flightTop=rect.top+scrollY;
    range=Math.max(1,flight.offsetHeight-innerHeight);
    root.dataset.spaceRange=String(Math.round(range));
    root.dataset.spaceFlightTop=String(Math.round(flightTop));
  }
  function scrollTarget() {
    return clamp((scrollY-flightTop)/range,0,1)*N;
  }
  function setStation(i) {
    i=clamp(i,0,N);
    if (i===active) return;
    active=i;
    cards.forEach((card,j)=>{
      const on=j===i;
      card.classList.toggle('is-active',on);
      card.setAttribute('aria-hidden',String(!on));
      card.inert=!on;
      if (!on && card.classList.contains('is-flipped')) turnCard(card,false,false);
    });
    dots.forEach((dot,j)=>{ dot.classList.toggle('is-active',j===i); dot.setAttribute('aria-current',j===i?'step':'false'); });
    root.dataset.spaceStation=String(i);
  }
  function go(i) {
    i=clamp(i,0,N);
    syncScrollGeometry();
    const y=flightTop+(i/N)*range;
    root.dataset.spaceRequested=String(i);
    if (reduced.matches || root.classList.contains('motion-paused')) {
      commanded=null;
      window.scrollTo(0,y);
      targetT=cameraT=i;
      setStation(i);
      wake();
      return;
    }
    commanded={station:i,y,started:performance.now()};
    window.scrollTo({top:y,left:0,behavior:'smooth'});
    targetT=i;
    wake();
  }
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));

  function turnCard(card, open, focus=true) {
    const front=card.querySelector('.product-front'),back=card.querySelector('.product-back'),trigger=card.querySelector('[data-product-inspect]');
    if (!front || !back || !trigger) return;
    card.classList.toggle('is-flipped',open);
    trigger.setAttribute('aria-expanded',String(open));
    front.inert=open; back.inert=!open;
    front.setAttribute('aria-hidden',String(open)); back.setAttribute('aria-hidden',String(!open));
    if (focus) (open?back.querySelector('.product-return'):trigger)?.focus({preventScroll:true});
  }
  document.querySelectorAll('.space-product-card').forEach(card=>{
    const trigger=card.querySelector('[data-product-inspect]'), back=card.querySelector('.product-back');
    trigger?.addEventListener('click',()=>turnCard(card,true));
    back?.querySelector('.product-return')?.addEventListener('click',()=>turnCard(card,false));
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const card=document.activeElement?.closest('.space-product-card.is-flipped');
    if(card)turnCard(card,false);
    if(shieldOpen && (shieldButton===document.activeElement || coreDetails?.contains(document.activeElement))){setShield(false);shieldButton?.focus({preventScroll:true});}
  });

  function setShield(open) {
    shieldOpen=!!open;
    shieldButton?.setAttribute('aria-expanded',String(shieldOpen));
    shieldButton?.setAttribute('aria-label',shieldOpen?'Close the MalGuard shield':'Open the MalGuard shield');
    if (coreDetails) { coreDetails.hidden=!shieldOpen; coreDetails.setAttribute('aria-hidden',String(!shieldOpen)); }
    root.dataset.spaceShield=shieldOpen?'open':'closed';
    wake();
  }
  shieldButton?.addEventListener('click',()=>setShield(!shieldOpen));

  function measure(wakeAfter=true) {
    syncScrollGeometry();
    W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);
    DPR=Math.min(lowQuality?1:1.75,devicePixelRatio||1);
    canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    F=Math.min(W*1.05,H*1.2);
    targetT=scrollTarget();
    if(reduced.matches || root.classList.contains('motion-paused'))cameraT=targetT;
    wake();
  }

  function drawStars(b, moving) {
    const count=lowQuality?130:stars.length;
    if(moving && prevBasis)ctx.beginPath();
    else ctx.fillStyle='rgba(215,230,255,.68)';
    for(let i=0;i<count;i++){
      const s=stars[i],p=project(s[0],s[1],s[2],b);if(!p)continue;
      if(moving && prevBasis){
        const q=project(s[0],s[1],s[2],prevBasis);if(!q)continue;
        ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);
      }else ctx.fillRect(p.x,p.y,s[3],s[3]);
    }
    if(moving && prevBasis){ctx.strokeStyle='rgba(215,230,255,.62)';ctx.lineWidth=1;ctx.stroke();}
  }
  function drawCore(b) {
    const p=project(0,0,0,b);if(!p)return;
    const h=Math.max(70,300*p.s),w=h*.775,glow=Math.max(180,h*2.4);
    ctx.drawImage(coreGlow,p.x-glow/2,p.y-glow/2,glow,glow);
    ctx.strokeStyle='rgba(170,186,208,.19)';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(p.x,p.y,w*1.35,h*.34,-.34,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(p.x,p.y,w*1.72,h*.24,.42,0,Math.PI*2);ctx.stroke();
    if(!shieldImage?.complete || !shieldImage.naturalWidth)return;
    const gap=shieldOpen?Math.max(8,w*.14):0;
    if(shieldOpen){
      ctx.save();ctx.beginPath();ctx.rect(p.x-w/2-gap,p.y-h/2,w/2,h);ctx.clip();ctx.drawImage(shieldImage,p.x-w/2-gap,p.y-h/2,w,h);ctx.restore();
      ctx.save();ctx.beginPath();ctx.rect(p.x+gap,p.y-h/2,w/2,h);ctx.clip();ctx.drawImage(shieldImage,p.x-w/2+gap,p.y-h/2,w,h);ctx.restore();
    }else ctx.drawImage(shieldImage,p.x-w/2,p.y-h/2,w,h);
  }
  function drawPlanet(item,b) {
    const p=project(item.p[0],item.p[1],item.p[2],b);if(!p)return;
    const r=item.r*p.s;if(r<2)return;
    const rx=r*1.75,ry=rx*.26;
    ctx.strokeStyle=item.ring;ctx.lineWidth=Math.max(1,r*.024);
    ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,-.34,Math.PI,Math.PI*2);ctx.stroke();
    ctx.drawImage(item.sprite,p.x-r,p.y-r,r*2,r*2);
    ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,-.34,0,Math.PI);ctx.stroke();
  }
  function drawFiles(b,now) {
    const un=[],sc=[],points=[]; const step=lowQuality?2:1; const ang=cameraT*.035,ca=Math.cos(ang),sa=Math.sin(ang);
    for(let i=0;i<files.length;i+=step){
      const f=files[i],x=f.x*ca+f.z*sa,z=-f.x*sa+f.z*ca,p=project(x,f.y,z,b);if(!p)continue;
      const s=clamp(f.s*p.s,5,34),a=f.rot+cameraT*.015,c=Math.cos(a),sn=Math.sin(a);
      const corners=[[-.62,-.8],[.42,-.8],[.62,-.58],[.62,.8],[-.62,.8]];
      const pts=corners.map(q=>({x:p.x+(q[0]*c-q[1]*sn)*s,y:p.y+(q[0]*sn+q[1]*c)*s}));
      points.push({f,p,s,pts});
    }
    if(pulse){
      const elapsed=now-pulse.start, radius=elapsed*.48, prev=Math.max(0,radius-34);
      let best=null,bestD=1e9;
      for(const o of points){
        const d=Math.hypot(o.p.x-pulse.x,o.p.y-pulse.y);
        if(!o.f.scanned && d<=radius && d>=prev && d<360){o.f.scanned=true;const delta=Math.abs(d-radius);if(delta<bestD){best=o;bestD=delta;}}
      }
      if(best){highlighted={f:best.f,x:best.p.x,y:best.p.y,until:now+1800};}
      if(radius>410)pulse=null;
    }
    for(const o of points)(o.f.scanned?sc:un).push(o);
    const drawGroup=(arr,color,width)=>{
      if(!arr.length)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
      for(const o of arr){const p=o.pts;ctx.moveTo(p[0].x,p[0].y);for(let j=1;j<p.length;j++)ctx.lineTo(p[j].x,p[j].y);ctx.closePath();ctx.moveTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.lineTo(p[1].x+(p[2].x-p[1].x)*.1,p[1].y+(p[2].y-p[1].y)*.72);}
      ctx.stroke();
    };
    drawGroup(un,'rgba(150,170,200,.52)',1);
    drawGroup(sc,'rgba(208,255,141,.94)',1.5);
    if(highlighted && now<highlighted.until){
      const match=points.find(o=>o.f===highlighted.f);
      if(match){highlighted.x=match.p.x;highlighted.y=match.p.y;scanLabel.textContent=highlighted.f.name+'  '+highlighted.f.hash;scanLabel.style.left=highlighted.x+'px';scanLabel.style.top=highlighted.y+'px';scanLabel.classList.add('is-visible');}
      else scanLabel.classList.remove('is-visible');
    }else{highlighted=null;scanLabel.classList.remove('is-visible');}
  }
  function drawPulse(now){
    if(!pulse)return;const radius=(now-pulse.start)*.48,alpha=clamp(1-radius/330,0,1);
    ctx.strokeStyle='rgba(208,255,141,'+(alpha*.85)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pulse.x,pulse.y,radius,0,Math.PI*2);ctx.stroke();
  }

  function render(now) {
    raf=0;
    const rawDt=last?now-last:16.7;last=now;const dt=Math.min(50,rawDt);
    ema+=(dt-ema)*.06;
    if(!lowQuality){slowFrames=ema>24?slowFrames+1:Math.max(0,slowFrames-2);if(slowFrames>75){lowQuality=true;root.dataset.spaceQuality='adaptive';measure(false);}}
    root.dataset.spaceFrameAverage=ema.toFixed(2);
    const scrollT=scrollTarget();
    if(commanded){
      targetT=commanded.station;
      const arrived=Math.abs(scrollY-commanded.y)<2;
      const expired=now-commanded.started>1600;
      if(arrived||expired){
        if(!arrived)window.scrollTo(0,commanded.y);
        commanded=null;
        targetT=scrollTarget();
      }
    }else targetT=scrollT;
    root.dataset.spaceScroll=String(Math.round(scrollY));
    root.dataset.spaceTarget=targetT.toFixed(3);
    if(paused())cameraT=targetT;else cameraT+=(targetT-cameraT)*.08;
    const c=currentCamera(cameraT),b=basis(c.p,c.l);
    const speed=prevPos?Math.hypot(c.p[0]-prevPos[0],c.p[1]-prevPos[1],c.p[2]-prevPos[2]):0;
    ctx.drawImage(bgSprite,0,0,W,H);
    drawStars(b,speed>3.2);
    const drawables=[{d:project(0,0,0,b)?.d||0,type:'core'}];
    planets.forEach((p,i)=>{const q=project(p.p[0],p.p[1],p.p[2],b);if(q)drawables.push({d:q.d,type:'planet',i});});
    drawables.sort((a,z)=>z.d-a.d).forEach(o=>o.type==='core'?drawCore(b):drawPlanet(planets[o.i],b));
    drawFiles(b,now);drawPulse(now);
    prevBasis=b;prevPos=c.p;frames++;root.dataset.spaceFrames=String(frames);
    const station=Math.round(cameraT);setStation(station);
    if(hint)hint.style.opacity=targetT>.18?'0':'1';
    root.dataset.spaceCamera=cameraT.toFixed(3);
    const moving=Math.abs(targetT-cameraT)>.0015;
    if(!paused() && (moving || pulse))raf=requestAnimationFrame(render);
  }
  function wake(){if(!raf && !document.hidden){last=performance.now();raf=requestAnimationFrame(render);}}

  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerDown={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId};},{passive:true});
  canvas.addEventListener('pointerup',e=>{
    if(!pointerDown || pointerDown.id!==e.pointerId)return;
    const d=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y),elapsed=performance.now()-pointerDown.t;
    if(d<8 && elapsed<550){pulse={x:e.clientX,y:e.clientY,start:performance.now()};wake();}
    pointerDown=null;
  },{passive:true});
  canvas.addEventListener('pointercancel',()=>pointerDown=null,{passive:true});
  addEventListener('scroll',wake,{passive:true});
  addEventListener('wheel',()=>{commanded=null;wake();},{passive:true});
  addEventListener('touchstart',()=>{commanded=null;wake();},{passive:true});
  addEventListener('resize',()=>requestAnimationFrame(measure),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
  addEventListener('malguard-motion',()=>{cameraT=scrollTarget();wake();});
  new MutationObserver(()=>measure()).observe(document.body,{attributes:true,attributeFilter:['class']});
  shieldImage?.addEventListener('load',wake,{once:true});
  reduced.addEventListener('change',()=>{cameraT=scrollTarget();wake();});

  setStation(0);setShield(false);measure();
  root.dataset.spaceQuality='full';root.dataset.collectionReady='true';root.dataset.spaceReady='true';
  window.__malguardSpace={go,metrics:()=>({station:active,frameAverage:ema,quality:root.dataset.spaceQuality,camera:cameraT})};
})();
