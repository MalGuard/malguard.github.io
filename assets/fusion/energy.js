/* One persistent Canvas2D particle field. Ten approved security forms preserve
   the reference's continuous, staggered morphing language; logo points are sampled
   from the unmodified original MalGuard SVG, never a drawn substitute. */
(() => {
  'use strict';
  // Timing copied from the supplied Cinematic HTML. 0.06 at 60 Hz,
  // delay in [0, .5), cubic smoothstep over .5 of each scroll interval.
  const particleSpeed=.92; // Subtle 8% reduction; shapes and scroll destinations stay unchanged.
  const referenceTiming={follow60:.06,particleDelay:.5,particleDuration:.5,
    revealThreshold:.35,wordStagger:.07,
    follow:(p,target,ms)=>p+(target-p)*(1-Math.pow(.94,ms*particleSpeed/(1000/60))),
    mix:(t,delay)=>{const q=Math.max(0,Math.min(1,(t-delay)/.5));return q*q*(3-2*q);}};
  let introElapsed=0,introComplete=false;
  const introDuration=3000;
  const canvas=document.getElementById('c'),ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const scenes=[...document.querySelectorAll('.scene[data-scene]')];
  const bar=document.getElementById('bar'),PI=Math.PI,TAU=PI*2;
  let seed=71473;
  function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  function gauss(){return(rnd()+rnd()+rnd()-1.5)/1.5;}
  const weak=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||8)<=4;
  const mobile=matchMedia('(max-width:900px)').matches;
  const N=mobile?(weak?1600:2600):(weak?3400:6200);
  let compositionX=0,compositionY=0,compositionScale=0;
  let active=N,W=0,H=0,D=1,anchors=[],target=0,P=0,raf=0,last=0,time=0,frames=0,measure=0,paused=false,visible=!document.hidden;
  const delay=new Float32Array(N),flow=new Float32Array(N*3),phases=new Float32Array(N);
  for(let i=0;i<N;i++){delay[i]=rnd()*referenceTiming.particleDelay;phases[i]=rnd()*TAU;for(let k=0;k<3;k++)flow[i*3+k]=gauss();}
  const shapes=[],hues=[];
  function make(fn){const a=new Float32Array(N*3),h=new Float32Array(N);for(let i=0;i<N;i++){const p=fn(i);a.set(p.slice(0,3),i*3);h[i]=p[3];}shapes.push(a);hues.push(h);}
  const palette=Array.from({length:72},(_,i)=>`hsla(${i*5},95%,62%,.9)`);
  const star=Array.from({length:mobile?180:420},()=>[rnd(),rnd(),.3+rnd()*.8,rnd()*TAU]);
  function rx(y,z,a){return[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];}
  // Approved direction 03: ten security silhouettes, sampled once into the
  // same particle identities. No bitmap backdrop, outlines or section overlays.
  const names=['File identity','File structure','Code inspection','Protection','Isolation','Scanning','Threat analysis','Fail-closed','Four layers','Evidence terminal','File hash','Link inspection','Verifiable evidence','MalGuard'];
  function sampleShape(paint,index){
    const off=document.createElement('canvas');off.width=512;off.height=512;
    const c=off.getContext('2d',{willReadFrequently:true});
    c.strokeStyle='#fff';c.fillStyle='#fff';c.lineWidth=5;c.lineCap='round';c.lineJoin='round';
    const line=(points)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();};
    paint(c,line);
    const pixels=c.getImageData(0,0,512,512).data,points=[];
    for(let y=30;y<482;y+=2)for(let x=30;x<482;x+=2)if(pixels[(y*512+x)*4+3]>100)points.push([x,y]);
    make(i=>{const pt=points[Math.floor(rnd()*points.length)];return[(pt[0]-256)/135+gauss()*.007,(pt[1]-256)/135+gauss()*.007,gauss()*.12,index===6&&Math.hypot(pt[0]-418,pt[1]-276)<26?350:185+pt[0]/512*55+(i%23===0?38:0)];});
  }
  sampleShape((c,line)=>{
    // Fingerprint ridges: unmistakable file identity, broad graceful flow.
    for(let r=22;r<173;r+=13){c.beginPath();c.ellipse(256,250,r,r*1.12,0,Math.PI*.75,Math.PI*2.62);c.stroke();}
    for(let n=0;n<7;n++){c.beginPath();c.moveTo(256+n*13,254);c.bezierCurveTo(256+n*13,320,235+n*18,354,213+n*22,419);c.stroke();}
  },0);
  sampleShape((c,line)=>{line([[149,92],[298,92],[363,158],[363,412],[149,412],[149,92]]);line([[298,92],[298,158],[363,158]]);for(let y=204;y<370;y+=23){line([[180,y],[324-(y%3)*10,y]]);}},1);
  sampleShape((c,line)=>{c.lineWidth=8;line([[190,162],[100,256],[190,350]]);line([[322,162],[412,256],[322,350]]);line([[289,128],[225,384]]);for(let y=196;y<338;y+=26){c.lineWidth=2;line([[200,y],[215,y]]);line([[302,y],[319,y]]);}},2);
  sampleShape((c,line)=>{c.lineWidth=7;c.beginPath();c.roundRect(145,220,222,180,23);c.stroke();c.beginPath();c.moveTo(190,220);c.lineTo(190,162);c.bezierCurveTo(190,68,322,68,322,162);c.lineTo(322,220);c.stroke();c.beginPath();c.arc(256,284,16,0,TAU);c.stroke();line([[256,300],[256,341]]);},3);
  sampleShape((c,line)=>{line([[256,91],[400,173],[400,338],[256,421],[112,338],[112,173],[256,91]]);line([[112,173],[256,256],[400,173]]);line([[256,256],[256,421]]);c.lineWidth=2;line([[177,235],[235,201],[293,235],[293,305],[235,339],[177,305],[177,235]]);for(let y=257;y<303;y+=14)line([[198,y],[263,y]]);},4);
  sampleShape((c,line)=>{for(let r=48;r<=177;r+=31){c.beginPath();c.arc(256,256,r,.08,TAU-.1);c.stroke();}c.lineWidth=3;line([[256,76],[256,436]]);line([[76,256],[436,256]]);for(let a=0;a<TAU;a+=.18){const r=65+(a/TAU)*105;c.beginPath();c.arc(256+Math.cos(a)*r,256+Math.sin(a)*r,2.7,0,TAU);c.fill();}},5);
  sampleShape((c,line)=>{const nodes=[[256,248],[136,137],[363,123],[418,276],[340,394],[149,392],[82,276],[236,91],[233,431]];c.lineWidth=2;nodes.slice(1).forEach((n,i)=>{line([nodes[0],n]);line([n,nodes[1+(i+1)%8]]);});nodes.forEach((n,i)=>{c.lineWidth=i?5:8;c.beginPath();c.arc(...n,i?17:31,0,TAU);c.stroke();});},6);
  sampleShape((c,line)=>{for(let row=0;row<6;row++)for(let col=0;col<4;col++){const x=144+col*57+(row%2?20:0),y=99+row*53;c.beginPath();c.roundRect(x,y,49,43,5);c.stroke();}c.lineWidth=2;for(let y=151;y<401;y+=39){line([[55,y],[122,y]]);line([[408,y],[459,y]]);}},7);
  sampleShape((c,line)=>{for(let i=0;i<4;i++){const y=141+i*70;line([[256,y-43],[406,y+9],[256,y+61],[106,y+9],[256,y-43]]);line([[106,y+9],[106,y+20],[256,y+72],[406,y+20],[406,y+9]]);}},8);
  sampleShape((c,line)=>{c.beginPath();c.roundRect(80,120,352,280,22);c.stroke();line([[80,168],[432,168]]);for(let i=0;i<3;i++){c.beginPath();c.arc(107+i*24,144,4,0,TAU);c.fill();}for(let i=0;i<6;i++)line([[110+i%2*22,205+i*29],[280+i%3*36,205+i*29]]);line([[342,335],[369,335],[369,359]]);},9);
  sampleShape((c,line)=>{for(let r of [125,169]){c.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6-PI/2;i?c.lineTo(256+Math.cos(a)*r,256+Math.sin(a)*r):c.moveTo(256+Math.cos(a)*r,256+Math.sin(a)*r);}c.stroke();}for(let x of [223,285])line([[x+14,181],[x-14,331]]);line([[187,232],[331,232]]);line([[181,280],[325,280]]);},10);
  sampleShape((c,line)=>{c.save();c.translate(256,256);c.rotate(-.6);for(let x of [-67,67]){c.beginPath();c.roundRect(x-90,-45,180,90,45);c.stroke();}c.restore();for(let r of [170,190]){c.beginPath();c.arc(256,256,r,.2,1.5);c.stroke();c.beginPath();c.arc(256,256,r,PI+.2,PI+1.5);c.stroke();}},11);
  sampleShape((c,line)=>{c.beginPath();c.arc(256,256,145,0,TAU);c.stroke();line([[176,251],[234,309],[338,195]]);for(let a=0;a<TAU;a+=TAU/16)line([[256+Math.cos(a)*168,256+Math.sin(a)*168],[256+Math.cos(a)*184,256+Math.sin(a)*184]]);},12);
  make(i=>[shapes[0][i*3],shapes[0][i*3+1],0,210]);
  let pointerX=0,pointerY=0,wantedX=0,wantedY=0,textZones=[];

  addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){wantedX=e.clientX/W-.5;wantedY=e.clientY/H-.5;}},{passive:true});
  // Readability comes from continuous light falloff, never DOM-shaped black masks.
  function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  function resize(){
    W=canvas.clientWidth;H=canvas.clientHeight;D=Math.min(devicePixelRatio||1,weak?1.25:1.75);
    canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);ctx.setTransform(D,0,0,D,0,0);
    updateAnchors();
    scroll();
  }
  function updateAnchors(){
    const top=el=>{let y=0;for(let node=el;node;node=node.offsetParent)y+=node.offsetTop;return y;};
    const demo=document.getElementById('demo'),layers=document.getElementById('layers'),products=document.getElementById('products');
    // EXACT reference mapping for its five narrative beats: scroll / (.after - .9H) * 4.
    // Keep our existing shapes; only copy the reference's normalized scroll timing.
    const narrativeEnd=Math.max(1,top(document.querySelector('.after'))-H*.9);
    anchors=Array.from({length:5},(_,v)=>({y:narrativeEnd*v/4,v}));
    // Continue the same gradual timeline through our additional Lab / stack / logo.
    // No short, artificial inter-copy morph windows and no layout changes.
    const lab= Math.max(narrativeEnd+H,top(demo)+H*.35);
    const graph=Math.max(lab+H*.75,top(demo)+demo.offsetHeight-H*.25);
    const stack=Math.max(graph+H*.75,top(layers)+H*.5);
    const product=Math.max(stack+H,top(products)-H*.35);
    const work=Math.max(product+H,top(document.getElementById('inside-analysis'))-H*.25),tools=Math.max(work+H,top(document.getElementById('local-tools'))-H*.25),trust=Math.max(tools+H,top(document.getElementById('trust'))-H*.25);
    const finale=Math.max(trust+H,top(scenes[5])-H*.35);
    anchors.push({y:lab,v:5},{y:graph,v:6},{y:stack,v:7},{y:Math.max(stack,product-H*.8),v:7},{y:product,v:8},{y:Math.max(product,work-H*.7),v:8},{y:work,v:9},{y:Math.max(work,tools-H*.8),v:9},{y:tools,v:10},{y:tools+H*.6,v:11},{y:trust,v:12},{y:Math.max(trust,finale-H*1.175),v:12},{y:finale,v:13});
    window.MalGuardParticles.timeline=anchors.map(h=>({...h}));
    window.MalGuardParticles.narrativeEnd=narrativeEnd;
  }
  function shapeAt(y){
    for(let i=0;i<anchors.length-1;i++){
      const a=anchors[i],b=anchors[i+1];
      if(y<=b.y){const p=Math.max(0,Math.min(1,(y-a.y)/Math.max(1,b.y-a.y)));return a.v+(b.v-a.v)*p;}
    }
    return 13;
  }
  function scroll(){
    updateAnchors();
    const y=scrollY;target=shapeAt(y);

    const max=document.documentElement.scrollHeight-H;bar.style.width=`${Math.max(0,Math.min(100,y/Math.max(1,max)*100))}%`;
    if(reduced.matches||paused)requestStill();
  }
  function requestStill(){if(!raf&&visible)raf=requestAnimationFrame(draw);}
  function ease(t){return t*t*t*(t*(t*6-15)+10);}
  function draw(ts){
    raf=0;if(!visible)return;
    const staticMotion=reduced.matches||paused;
    if(canvas.clientWidth!==W||canvas.clientHeight!==H)resize();
    ctx.setTransform(D,0,0,D,0,0);
    const elapsed=last?Math.min(250,ts-last):16,dt=Math.min(50,elapsed);last=ts;
    if(!staticMotion)time+=dt*particleSpeed;
    const start=performance.now();
    P=staticMotion?target:referenceTiming.follow(P,target,elapsed);
    if(Math.abs(target-P)<.001)P=target;
    if(!introComplete){
      const opening=window.MalGuardOpening?.state();
      if(staticMotion||target>.15)introElapsed=introDuration;
      else if(opening)introElapsed=opening.particleProgress*introDuration;
      else introElapsed+=elapsed*particleSpeed;
      if(introElapsed>=introDuration){
        introComplete=true;
        document.body.dataset.intro='ready';
        scenes[0].classList.add('in');
      }
    }
    canvas.dataset.introProgress=String(Math.min(1,introElapsed/introDuration));
    canvas.dataset.introComplete=String(introComplete);
    ctx.globalCompositeOperation='source-over';ctx.fillStyle=staticMotion?'#000000':'rgba(0,0,0,.34)';ctx.fillRect(0,0,W,H);
    const wide=W>900||(W>650&&H<550);
    const finalWeight=smooth(12.35,13,P);
    const chamberRect=document.getElementById('sc3').getBoundingClientRect();
    const layerRect=document.getElementById('layers').getBoundingClientRect(),rightCopy=wide&&layerRect.top<H*.3&&layerRect.bottom>H*.7;
    const goalX=W*(wide?(rightCopy?.27:.62+finalWeight*.10):.5);
    const goalY=H*(wide?.5:.4);
    const immersiveScale=wide?Math.min(W*.31,H*.27):Math.min(W*.40,H*.27);
    const finalScale=wide?Math.min(W*.22,H*.28):Math.min(W*.33,H*.26);
    const goalScale=immersiveScale+(finalScale-immersiveScale)*finalWeight;
    const settle=staticMotion?1:1-Math.exp(-elapsed/100);
    compositionX=compositionX?compositionX+(goalX-compositionX)*settle:goalX;
    compositionY=compositionY?compositionY+(goalY-compositionY)*settle:goalY;
    compositionScale=compositionScale?compositionScale+(goalScale-compositionScale)*settle:goalScale;
    const cx=compositionX,cy=compositionY,scale=compositionScale;
    for(const s of star){const x=s[0]*W,y=s[1]*H;ctx.globalAlpha=staticMotion?.26:.18+.1*Math.sin(time*.00065+s[3]);ctx.fillStyle='#91a9cb';ctx.fillRect(x,y,s[2],s[2]);}
    ctx.globalAlpha=1;
    const k=Math.min(12,Math.floor(P)),t=P-k,A=shapes[k],B=shapes[k+1],HA=hues[k],HB=hues[k+1];
    const logoWeight=k===12?ease(Math.max(0,(t-.45)/.55)):0;
    pointerX+=(wantedX-pointerX)*.05;pointerY+=(wantedY-pointerY)*.05;
    const ang=(staticMotion?0:Math.sin(time*.00013)*.17+pointerX*.22)*(1-logoWeight),ca=Math.cos(ang),sa=Math.sin(ang);
    const tilt=staticMotion?0:pointerY*.18,ct=Math.cos(tilt),st=Math.sin(tilt);
    let drawn=0,underText=0;
    // During the opening's opaque geometry shot, particles have no exposure.
    // Save their draw cost until the continuous field joins the handoff.
    const openingSuppressed=window.MalGuardOpening?.state().elapsed<4000;
    const openingExposure=window.MalGuardOpening?smooth(4250,5900,window.MalGuardOpening.state().elapsed):1;
    for(let i=0;i<(openingSuppressed?0:active);i++){
      const j=i*3;
      const v=referenceTiming.mix(t,delay[i]);
      const arc=Math.sin(v*PI),twist=arc*.65,ctw=Math.cos(twist),stw=Math.sin(twist);
      let X=A[j]+(B[j]-A[j])*v,Y=A[j+1]+(B[j+1]-A[j+1])*v,Z=A[j+2]+(B[j+2]-A[j+2])*v;
      const xsw=X*ctw-Z*stw;Z=X*stw+Z*ctw;X=xsw;
      // Particles arrive with individual delays, settle into our unchanged
      // fingerprint, then the hero copy is released once every point has arrived.
      const arrival=staticMotion?1:ease(Math.max(0,Math.min(1,(introElapsed-delay[i]*1200)/2400)));
      const entry=(1-arrival)*(1-smooth(0,.65,P));
      const entryAngle=entry*(1.5+delay[i]);
      const ex=X*Math.cos(entryAngle)-Y*Math.sin(entryAngle);
      Y=X*Math.sin(entryAngle)+Y*Math.cos(entryAngle);X=ex;
      X+=flow[j]*entry*2.3;Y+=flow[j+1]*entry*1.8;Z+=flow[j+2]*entry;
      X+=flow[j]*arc*.75;Y+=flow[j+1]*arc*.5;Z+=flow[j+2]*arc*.65;
      const breathing=staticMotion?1:1+Math.sin(time*.0009+phases[i])*.014;
      X*=breathing;Y*=breathing;
      if(!staticMotion){X+=Math.sin(time*.0007+phases[i])*.018*(1-logoWeight);Y+=Math.cos(time*.0009+phases[i])*.018*(1-logoWeight);}
      const X2=X*ca+Z*sa,Z2=-X*sa+Z*ca,Y2=Y*ct-Z2*st,Z3=Y*st+Z2*ct;
      const f=4.8/(Z3+4.8);
      const spread=i%17===0?1+arc*1.5:1;
      const px=cx+X2*scale*f*spread,py=cy+Y2*scale*f*spread+(staticMotion?0:Math.sin(time*.00065)*2*logoWeight);
      if(px<0||px>W||py<0||py>H)continue;
      const hue=(HA[i]+(HB[i]-HA[i])*v+360)%360;
      const sz=Math.max(.7,Math.min(2.6,f*1.6));
      // Every point remains present across the full viewport. The text side is softly lit.
      const light=wide?(rightCopy?.05+.55*(1-smooth(.26,.52,px/W)):.16+.74*smooth(.2,.72,px/W)):.14+.76*(1-smooth(.28,.8,py/H));
      if(wide?px<W*.45:py>H*.45)underText++;
      let textLight=1;
      const chamberDistance=Math.hypot((px-(chamberRect.left+chamberRect.width/2))/(chamberRect.width*.85),(py-(chamberRect.top+chamberRect.height/2))/(chamberRect.height*.9));textLight*=.04+.96*smooth(.45,1.3,chamberDistance);
      ctx.globalAlpha=light*textLight*openingExposure;ctx.fillStyle=palette[Math.floor(hue/5)%72];ctx.fillRect(px,py,sz,sz);
      drawn++;
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    const cost=performance.now()-start;frames++;measure+=cost;
    // Adapt once per 90 frames. No new arrays, no particle identity changes.
    if(frames>=90){if(measure/frames>12){active=Math.max(900,Math.floor(active*.8));}frames=0;measure=0;}
    canvas.dataset.phase=Number.isInteger(target)?'hold':'morph';canvas.dataset.held=String(Number.isInteger(target)&&P===target);
    canvas.dataset.renderer='immersive-security-field';canvas.dataset.form=names[Math.round(P)];canvas.dataset.formCount='14';canvas.dataset.blackMasks='0';canvas.dataset.filaments='0';canvas.dataset.scene=P.toFixed(3);canvas.dataset.target=target.toFixed(3);canvas.dataset.particles=String(active);canvas.dataset.drawn=String(drawn);canvas.dataset.masked='0';canvas.dataset.underText=String(underText);canvas.dataset.frameMs=cost.toFixed(2);canvas.dataset.logoReady=String(logoReady);
    if(!staticMotion)raf=requestAnimationFrame(draw);
  }
  let logoReady=false;
  const logo=new Image();
  logo.onload=()=>{
    const off=document.createElement('canvas');off.width=360;off.height=360;const oc=off.getContext('2d',{willReadFrequently:true});oc.drawImage(logo,0,0,360,360);
    const rgba=oc.getImageData(0,0,360,360).data,points=[];
    for(let y=28;y<330;y+=2)for(let x=60;x<300;x+=2){const j=(y*360+x)*4;if(rgba[j+3]>140)points.push([(x-180)/111,(y-178)/111,rgba[j+1]>rgba[j+2]*.7?190:222]);}
    if(points.length){
      for(let i=0;i<N;i++){
        const pt=points[Math.floor(rnd()*points.length)],j=i*3;
        shapes[13][j]=pt[0]+gauss()*.01;shapes[13][j+1]=pt[1]+gauss()*.01;shapes[13][j+2]=gauss()*.025;hues[13][i]=pt[2];

      }
      logoReady=true;
    }
    requestStill();
  };
  logo.onerror=()=>{canvas.dataset.assetError='Original logo could not be decoded';requestStill();};
  logo.src='/assets/fusion/assets/malguard-logo.svg';
  addEventListener('scroll',scroll,{passive:true});
  let lastWidth=innerWidth;
  addEventListener('resize',()=>{
    // Mobile Safari toolbar height changes do not reseed shapes or reset scroll smoothing.
    if(Math.abs(innerWidth-lastWidth)>1){lastWidth=innerWidth;}resize();
  });
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(!visible){cancelAnimationFrame(raf);raf=0;}else{last=0;requestStill();}});
  window.addEventListener('mg:motion',e=>{paused=e.detail.paused;cancelAnimationFrame(raf);raf=0;requestStill();});
  reduced.addEventListener('change',()=>{cancelAnimationFrame(raf);raf=0;requestStill();});
  window.MalGuardParticles={timeline:[],shapeAt,referenceTiming,restartIntro:()=>{
    introElapsed=0;introComplete=false;document.body.dataset.intro='assembling';
    scenes[0].classList.remove('in');requestStill();
  }};
  resize();
  // WebKit may finalize fixed-canvas metrics after its initial mobile layout.
  new ResizeObserver(()=>{if(canvas.clientWidth!==W||canvas.clientHeight!==H){resize();requestStill();}}).observe(canvas);
  document.fonts.ready.then(()=>{resize();requestStill();});
})();
