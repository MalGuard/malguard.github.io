/* One persistent light field, with volumetric reference forms and a Canvas
   fallback. The final logo is sampled from the original MalGuard SVG. */
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
  const tryGPU=!!window.createMalGuardFieldRenderer&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  let canvas=document.getElementById('c'),gpu=tryGPU?window.createMalGuardFieldRenderer(canvas):null,ctx;
  function canvasFallback(){if(gpu){gpu.dispose();gpu=null;}const next=canvas.cloneNode(false);canvas.replaceWith(next);canvas=next;ctx=canvas.getContext('2d',{alpha:false});canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);ctx?.setTransform(D,0,0,D,0,0);active=Math.min(active,mobile?3000:5000);last=0;if(!drawing)requestStill();}
  if(!gpu){if(tryGPU){const next=canvas.cloneNode(false);canvas.replaceWith(next);canvas=next;}ctx=canvas.getContext('2d',{alpha:false});}
  if(!gpu&&!ctx)return;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();canvasFallback();});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const scenes=[...document.querySelectorAll('.scene[data-scene]')];
  const bar=document.getElementById('bar'),PI=Math.PI,TAU=PI*2;
  let seed=71473;
  function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  function gauss(){return(rnd()+rnd()+rnd()-1.5)/1.5;}
  const weak=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||8)<=4;
  const mobile=matchMedia('(max-width:900px)').matches;
  const N=gpu?(mobile?(weak?4600:6800):(weak?8500:14500)):(mobile?2800:5200);
  let compositionX=0,compositionY=0,compositionScale=0;
  let active=N,W=0,H=0,D=1,anchors=[],target=0,P=0,scrollPosition=scrollY,raf=0,last=0,time=0,drawing=false,frames=0,measure=0,paused=false,visible=!document.hidden;
  const delay=new Float32Array(N),flow=new Float32Array(N*3),phases=new Float32Array(N);
  for(let i=0;i<N;i++){delay[i]=rnd()*referenceTiming.particleDelay;phases[i]=rnd()*TAU;for(let k=0;k<3;k++)flow[i*3+k]=gauss();}
  const shapes=[],hues=[];
  function make(fn){const a=new Float32Array(N*3),h=new Float32Array(N);for(let i=0;i<N;i++){const p=fn(i);a.set(p.slice(0,3),i*3);h[i]=p[3];}shapes.push(a);hues.push(h);}
  const palette=Array.from({length:72},(_,i)=>`hsla(${i*5},95%,62%,.9)`);
  const rgb=Array.from({length:72},(_,n)=>{const h=n/12,f=k=>{const a=(k+h)%6;return .5-.45*Math.max(-1,Math.min(a,4-a,1));};return[f(5),f(3),f(1)];});
  const star=Array.from({length:mobile?180:420},()=>[rnd(),rnd(),.3+rnd()*.8,rnd()*TAU]);
  function rx(y,z,a){return[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];}
  // Additional security compositions reuse the same particle identities.
  // No bitmap backdrop or section overlay replaces the continuous field.
  const names=['Energy aperture','Evidence strands','Signal wave','Inspection vortex','Evidence constellation','Scanning','Threat analysis','Fail-closed','Four layers','Evidence terminal','File hash','Link inspection','Verifiable evidence','MalGuard'];
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
  // Volumetric reference forms. Every point retains its identity through all
  // five compositions; these are surfaces in depth, not traced bitmap icons.
  make(i=>{const lane=i%7,a=Math.floor(i/7)/Math.ceil(N/7)*TAU,v=lane*TAU/7,r=1.55+Math.cos(v)*.035+Math.sin(a*9+v)*.025+Math.sin(a*17+v*2)*.012;return[Math.cos(a)*r*1.38,Math.sin(a)*r,Math.sin(v)*.07+Math.sin(a*5)*.025,195+(Math.sin(a)+1)*65+(Math.cos(a)+1)*6];});
  make(i=>{const u=rnd(),y=(u-.5)*3.6,a=u*17+(i%2)*PI,r=.57+gauss()*.065;if(i%6===0){const k=Math.floor(u*34)/34,t=rnd(),b=k*17;return[Math.cos(b)*r*(1-2*t),(k-.5)*3.6,Math.sin(b)*r*(1-2*t),205];}return[Math.cos(a)*r,y,Math.sin(a)*r,190+u*70];});
  make(i=>{const cols=180,rows=Math.ceil(N/cols),x=(i%cols)/(cols-1)*6-3,z=(Math.floor(i/cols)/Math.max(1,rows-1)-.5)*2.2,y=Math.sin(x*1.5+z*2)*.18+Math.sin(x*3.7-z)*.045;return[x,y+z*.26,z,190+(x+3)/6*95];});
  make(i=>{const a=i/N*TAU*71,r=.30+Math.pow(rnd(),.55)*2.1,y=-.62/(r+.12)+.30;return[Math.cos(a)*r,y+Math.sin(a)*r*.22,Math.sin(a)*r*.78,200+(r/2.4)*65];});
  make(i=>{if(i%23===0)return[gauss()*.2,gauss()*.08,gauss()*.2,35+rnd()*25];const r=Math.pow((i%Math.ceil(N/3))/Math.ceil(N/3),.75)*2.4+.01,a=Math.floor(i/Math.ceil(N/3))*TAU/3+r*2.5+gauss()*.12,z=Math.sin(a)*r;return[Math.cos(a)*r,z*.24+gauss()*.045,z*.9,200+r/2.4*90];});
  sampleShape((c,line)=>{for(let r=48;r<=177;r+=31){c.beginPath();c.arc(256,256,r,.08,TAU-.1);c.stroke();}c.lineWidth=3;line([[256,76],[256,436]]);line([[76,256],[436,256]]);for(let a=0;a<TAU;a+=.18){const r=65+(a/TAU)*105;c.beginPath();c.arc(256+Math.cos(a)*r,256+Math.sin(a)*r,2.7,0,TAU);c.fill();}},5);
  sampleShape((c,line)=>{const nodes=[[256,248],[136,137],[363,123],[418,276],[340,394],[149,392],[82,276],[236,91],[233,431]];c.lineWidth=2;nodes.slice(1).forEach((n,i)=>{line([nodes[0],n]);line([n,nodes[1+(i+1)%8]]);});nodes.forEach((n,i)=>{c.lineWidth=i?5:8;c.beginPath();c.arc(...n,i?17:31,0,TAU);c.stroke();});},6);
  sampleShape((c,line)=>{for(let row=0;row<6;row++)for(let col=0;col<4;col++){const x=144+col*57+(row%2?20:0),y=99+row*53;c.beginPath();c.roundRect(x,y,49,43,5);c.stroke();}c.lineWidth=2;for(let y=151;y<401;y+=39){line([[55,y],[122,y]]);line([[408,y],[459,y]]);}},7);
  sampleShape((c,line)=>{for(let i=0;i<4;i++){const y=141+i*70;line([[256,y-43],[406,y+9],[256,y+61],[106,y+9],[256,y-43]]);line([[106,y+9],[106,y+20],[256,y+72],[406,y+20],[406,y+9]]);}},8);
  sampleShape((c,line)=>{c.beginPath();c.roundRect(80,120,352,280,22);c.stroke();line([[80,168],[432,168]]);for(let i=0;i<3;i++){c.beginPath();c.arc(107+i*24,144,4,0,TAU);c.fill();}for(let i=0;i<6;i++)line([[110+i%2*22,205+i*29],[280+i%3*36,205+i*29]]);line([[342,335],[369,335],[369,359]]);},9);
  sampleShape((c,line)=>{for(let r of [125,169]){c.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6-PI/2;i?c.lineTo(256+Math.cos(a)*r,256+Math.sin(a)*r):c.moveTo(256+Math.cos(a)*r,256+Math.sin(a)*r);}c.stroke();}for(let x of [223,285])line([[x+14,181],[x-14,331]]);line([[187,232],[331,232]]);line([[181,280],[325,280]]);},10);
  sampleShape((c,line)=>{c.save();c.translate(256,256);c.rotate(-.6);for(let x of [-67,67]){c.beginPath();c.roundRect(x-90,-45,180,90,45);c.stroke();}c.restore();for(let r of [170,190]){c.beginPath();c.arc(256,256,r,.2,1.5);c.stroke();c.beginPath();c.arc(256,256,r,PI+.2,PI+1.5);c.stroke();}},11);
  sampleShape((c,line)=>{c.beginPath();c.arc(256,256,145,0,TAU);c.stroke();line([[176,251],[234,309],[338,195]]);for(let a=0;a<TAU;a+=TAU/16)line([[256+Math.cos(a)*168,256+Math.sin(a)*168],[256+Math.cos(a)*184,256+Math.sin(a)*184]]);},12);
  make(i=>[shapes[0][i*3],shapes[0][i*3+1],0,210]);
  let pointerX=0,pointerY=0,wantedX=0,wantedY=0,textZones=[],zonesAt=-1000;

  addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){wantedX=e.clientX/W-.5;wantedY=e.clientY/H-.5;}},{passive:true});
  // Readability comes from continuous light falloff, never DOM-shaped black masks.
  function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  function resize(){
    W=canvas.clientWidth;H=canvas.clientHeight;D=Math.min(devicePixelRatio||1,weak?1.5:2);
    canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);canvas.dataset.pixelRatio=String(D);ctx?.setTransform(D,0,0,D,0,0);
    updateAnchors();
    scroll();
  }
  function updateAnchors(){
    const top=el=>{let y=0;for(let node=el;node;node=node.offsetParent)y+=node.offsetTop;return y;};
    const demo=document.getElementById('demo'),layers=document.getElementById('layers'),products=document.getElementById('products');
    // The original reference mapping remains the module-loading fallback.
    // In normal operation, shape and type share each measured reading hold.
    const narrativeEnd=Math.max(1,top(document.querySelector('.after'))-H*.9);
    const story=window.MalGuardParticleStory;
    anchors=story?story.records.slice(0,5).flatMap(r=>[{y:r.start,v:r.index},{y:r.start+r.height*.54,v:r.index}]):Array.from({length:5},(_,v)=>({y:narrativeEnd*v/4,v}));
    if(story)anchors.push({y:top(document.querySelector('.after')),v:5});
    // Continue the same gradual timeline through our additional Lab / stack / logo.
    // Each additional module retains its existing native scroll range.
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
    const y=scrollY;target=shapeAt(y);

    const max=document.documentElement.scrollHeight-H;bar.style.width=`${Math.max(0,Math.min(100,y/Math.max(1,max)*100))}%`;
    if(reduced.matches||paused)requestStill();
  }
  function requestStill(){if(!raf&&visible)raf=requestAnimationFrame(draw);}
  function ease(t){return t*t*t*(t*(t*6-15)+10);}
  function draw(ts){
    raf=0;if(!visible)return;drawing=true;
    const staticMotion=reduced.matches||paused;
    if(canvas.clientWidth!==W||canvas.clientHeight!==H)resize();
    ctx?.setTransform(D,0,0,D,0,0);
    const elapsed=last?Math.min(250,ts-last):16,dt=Math.min(50,elapsed);last=ts;
    if(!staticMotion)time+=dt*particleSpeed;
    const start=performance.now();
    if(ts-zonesAt>160){zonesAt=ts;textZones=[...document.querySelectorAll('.after h2,.after h3,.after p,.after a,.after button,.after .tag,.after .section-top,#layers .steps,#demo .lab-copy')].map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0&&r.bottom>0&&r.top<H);}
    scrollPosition=staticMotion?scrollY:referenceTiming.follow(scrollPosition,scrollY,elapsed);
    if(Math.abs(scrollPosition-scrollY)<.05)scrollPosition=scrollY;
    P=shapeAt(scrollPosition);
    let openingTime=null,openingState=null;
    if(!introComplete){
      const opening=window.MalGuardOpening?.state();
      if(opening){openingTime=opening.elapsed;openingState=opening;}
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
    gpu?.begin();if(ctx){ctx.globalCompositeOperation='source-over';ctx.fillStyle='#020409';ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='lighter';}
    const wide=W>900||(W>650&&H<550);
    const finalWeight=smooth(12.35,13,P);
    const chamberRect=document.getElementById('sc3').getBoundingClientRect();
    const layerRect=document.getElementById('layers').getBoundingClientRect(),rightCopy=wide&&layerRect.top<H*.3&&layerRect.bottom>H*.7;
    const readingRecord=window.MalGuardParticleStory?.records[Math.min(4,Math.round(P))];
    const readingTop=readingRecord?parseFloat(readingRecord.copy.style.getPropertyValue('--reading-top')):H*.52;
    const readingOnRight=readingRecord&&readingRecord.copy.getBoundingClientRect().left>W*.35;
    const skyTop=(document.querySelector('nav')?.getBoundingClientRect().bottom||70)+24;
    const skyBottom=Math.max(skyTop+90,readingTop-28);
    const shortTouch=W<=900&&H<=700;
    const narrative=P<4.01,beat=Math.min(4,Math.round(P)),portal=narrative&&beat===0,lowWide=wide&&H<750;
    const goalX=shortTouch?W*(readingOnRight?.18:.82):W*(wide?(narrative?(portal?.5:beat===2||beat===4?(lowWide?.82:.53):beat===3?.80:.76):(rightCopy||readingOnRight?.27:.70+finalWeight*.03)):.5);
    const goalY=shortTouch?H*.36:wide?(narrative?(beat===2||beat===4?(lowWide?H*.5:H*(beat===4?.90:.83)):H*.5):H*.5):(skyTop+skyBottom)*.5;
    const immersiveScale=shortTouch?Math.min(W*.07,H*.12):wide?(narrative?(portal?Math.min(W*.25,H*.31):beat===2||beat===4?(lowWide?Math.min(W*.10,H*.12):Math.min(W*.18,H*(beat===4?.24:.29))):beat===3?Math.min(W*.20,H*.21):Math.min(W*.26,H*.25)):Math.min(W*.31,H*.27)):Math.min(W*(portal?.24:.26),(skyBottom-skyTop)/(beat===1?4.3:3.8));
    const finalScale=wide?Math.min(W*.22,H*.28):Math.min(W*.33,H*.26);
    const goalScale=immersiveScale+(finalScale-immersiveScale)*finalWeight;
    const settle=staticMotion?1:1-Math.exp(-elapsed/100);
    compositionX=compositionX?compositionX+(goalX-compositionX)*settle:goalX;
    compositionY=compositionY?compositionY+(goalY-compositionY)*settle:goalY;
    compositionScale=compositionScale?compositionScale+(goalScale-compositionScale)*settle:goalScale;
    const cx=compositionX,cy=compositionY,scale=compositionScale;
    const cameraTravel=staticMotion?0:Math.sin((P-Math.floor(P))*PI)**2;

    function paintPoint(x,y,size,hue,alpha){if(gpu){const c=rgb[(Math.floor(hue/5)%72+72)%72];gpu.point(x,y,size,...c,alpha);}else{ctx.globalAlpha=alpha;ctx.fillStyle=palette[(Math.floor(hue/5)%72+72)%72];ctx.beginPath();ctx.arc(x,y,Math.max(.35,size*.22),0,TAU);ctx.fill();}}
    for(const s of star){const travel=cameraTravel*.8,x=(s[0]-.5)*W*(1+travel)+W*.5,y=(s[1]-.5)*H*(1+travel)+H*.5;paintPoint(x,y,s[2]*2.5*(1+cameraTravel),215,staticMotion?.25:.20+.15*Math.sin(time*.00065+s[3]));}
    gpu?.startBloom();if(ctx)ctx.globalAlpha=1;
    const k=Math.min(12,Math.floor(P)),t=P-k,A=shapes[k],B=shapes[k+1],HA=hues[k],HB=hues[k+1];
    const logoWeight=k===12?ease(Math.max(0,(t-.45)/.55)):0;
    pointerX+=(wantedX-pointerX)*.05;pointerY+=(wantedY-pointerY)*.05;
    const ang=(staticMotion?0:Math.sin(time*.00013)*.17+pointerX*.22)*(1-logoWeight),ca=Math.cos(ang),sa=Math.sin(ang);
    const tilt=staticMotion?0:pointerY*.18,ct=Math.cos(tilt),st=Math.sin(tilt);
    let drawn=0,underText=0,readingHits=0,minX=W,maxX=0,minY=H,maxY=0;
    const reading=storyCopy();function storyCopy(){const rec=window.MalGuardParticleStory?.records.find(r=>r.opacity>.8&&r.scene.getBoundingClientRect().top<H&&r.scene.getBoundingClientRect().bottom>0);return rec?.copy.getBoundingClientRect();}
    // During the opening's opaque geometry shot, particles have no exposure.
    // Save their draw cost until the continuous field joins the handoff.
    if(openingTime===null&&window.MalGuardOpening){openingState=window.MalGuardOpening.state();openingTime=openingState.elapsed;}
    const releaseAt=openingState?.releaseAt??5400,gatherAt=openingState?.gatherAt??6150,formedAt=openingState?.formedAt??7450;
    const openingSuppressed=openingTime!==null&&openingTime<releaseAt;
    const openingExposure=openingTime===null||openingState?.complete?1:smooth(releaseAt,releaseAt+100,openingTime);
    const openingPhase=openingTime===null?'idle':openingTime<releaseAt?'portal':openingTime<releaseAt+650?'flare':openingTime<formedAt?'settle':'formed';
    canvas.dataset.openingPhase=openingPhase;
    const story=window.MalGuardParticleStory;
    story?.update(scrollPosition,openingState,elapsed,staticMotion,P);
    // The physical aperture and emitted field share the exact viewport origin.
    const burstX=W*(openingState?.portalX??cx/W),burstY=H*(openingState?.portalY??cy/H);
    const burstRadius=Math.min(W,H)*.68;
    if(ctx&&openingTime!==null&&!openingState?.complete&&openingTime>(openingState?.spinAt??3400)&&openingTime<releaseAt+800){
      const charge=openingState?.charge??0,turn=openingState?.quantumTurn??0;
      const fade=1-smooth(releaseAt-40,releaseAt+160,openingTime);
      ctx.save();ctx.translate(burstX,burstY);ctx.globalCompositeOperation='lighter';
      // Restrained precessing orbital trails: acceleration is visible before
      // the release; no separate layer or black backdrop covers the page.
      for(let n=0;n<5;n++){
        const radius=Math.min(W,H)*(.12+charge*.07+n*.008);
        ctx.save();ctx.rotate(turn*.24+n*PI/5);ctx.globalAlpha=charge*fade*(.1+n*.016);
        ctx.strokeStyle='#9cdcf7';ctx.lineWidth=.65;ctx.beginPath();ctx.ellipse(0,0,radius,radius*(.27+n*.055),0,0,TAU);ctx.stroke();ctx.restore();
      }
      ctx.restore();
      if(openingTime>=releaseAt-90){
        const p=Math.max(0,(openingTime-releaseAt)/800),strength=openingState.burst;
        const radius=Math.min(W,H)*(.045+.65*(1-Math.exp(-p*5)));
        const glow=ctx.createRadialGradient(burstX,burstY,0,burstX,burstY,radius);
        glow.addColorStop(0,`rgba(238,250,255,${.9*strength})`);
        glow.addColorStop(.05,`rgba(170,221,255,${.7*strength})`);
        glow.addColorStop(.25,`rgba(69,145,255,${.2*strength})`);
        glow.addColorStop(1,'rgba(40,105,255,0)');
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1;ctx.fillStyle=glow;
        ctx.fillRect(burstX-radius,burstY-radius,radius*2,radius*2);
        ctx.strokeStyle=`rgba(168,223,255,${.55*(1-smooth(releaseAt+180,releaseAt+800,openingTime))})`;
        ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(burstX,burstY,radius*.92,0,TAU);ctx.stroke();ctx.restore();
      }
    }
    let previous=null;
    for(let i=0;i<(openingSuppressed?0:active);i++){
      const j=i*3;
      const v=referenceTiming.mix(t,delay[i]);
      const arc=Math.sin(v*PI),twist=arc*.65,ctw=Math.cos(twist),stw=Math.sin(twist);
      let X=A[j]+(B[j]-A[j])*v,Y=A[j+1]+(B[j+1]-A[j+1])*v,Z=A[j+2]+(B[j+2]-A[j+2])*v;
      const xsw=X*ctw-Z*stw;Z=X*stw+Z*ctw;X=xsw;
      // Individual delays resolve the aperture before the reading hold; the
      // same points then pass through all subsequent compositions.
      const arrival=staticMotion?1:ease(Math.max(0,Math.min(1,(introElapsed-delay[i]*1200)/2400)));
      const entry=openingState?0:(1-arrival)*(1-smooth(0,.65,P));
      const entryAngle=entry*(1.5+delay[i]);
      const ex=X*Math.cos(entryAngle)-Y*Math.sin(entryAngle);
      Y=X*Math.sin(entryAngle)+Y*Math.cos(entryAngle);X=ex;
      X+=flow[j]*entry*2.3;Y+=flow[j+1]*entry*1.8;Z+=flow[j+2]*entry;
      X+=flow[j]*arc*.75;Y+=flow[j+1]*arc*.5;Z+=flow[j+2]*arc*.65;
      // A camera-like passage through the shared field happens only between
      // readable holds. Forward and reverse scroll use identical trajectories.
      X*=1+cameraTravel*.48;Y*=1+cameraTravel*.35;Z-=cameraTravel*1.5;
      const breathing=staticMotion?1:1+Math.sin(time*.0009+(k<5?0:phases[i]))*.008;
      X*=breathing;Y*=breathing;
      if(!staticMotion&&k>=5){X+=Math.sin(time*.0007+phases[i])*.018*(1-logoWeight);Y+=Math.cos(time*.0009+phases[i])*.018*(1-logoWeight);}
      if(k===0){const ripple=staticMotion?1:1+Math.sin(Math.atan2(Y,X)*7+time*.00045)*.018+Math.sin(Math.atan2(Y,X)*17-time*.0007)*.01;X*=ripple;Y*=ripple;}
      if(k===0&&wide){const a=staticMotion?0:time*.000065,c=Math.cos(a),s=Math.sin(a),q=X;X=q*c-Y*s;Y=q*s+Y*c;}
      if(k===0&&!wide)X/=1.38;
      if(k===1){const a=staticMotion?0:time*.00018,c=Math.cos(a),s=Math.sin(a),q=X;X=q*c+Z*s;Z=-q*s+Z*c;}
      if(k===2&&!staticMotion)Y+=Math.sin(X*2+Z+time*.0006)*.065;
      const X2=X*ca+Z*sa,Z2=-X*sa+Z*ca,Y2=Y*ct-Z2*st,Z3=Y*st+Z2*ct;
      const f=4.8/(Z3+4.8);
      const spread=i%17===0?1+arc*1.5:1;
      let px=cx+X2*scale*f*spread,py=cy+Y2*scale*f*spread+(staticMotion?0:Math.sin(time*.00065)*2*logoWeight);
      if(openingTime!==null&&!openingState?.complete&&openingTime>=releaseAt&&openingTime<formedAt){
        const flight=1-Math.exp(-(openingTime-releaseAt)/430);
        const gather=ease(Math.max(0,Math.min(1,(openingTime-gatherAt-delay[i]*430)/(formedAt-gatherAt-215))));
        const angle=phases[i]+(openingState.quantumTurn||0)*.22+(1-gather)*flight*.7;
        // Deterministic depth and velocity retain every particle's identity.
        const depth=Math.sqrt(Math.max(.015,1-flow[j+2]*flow[j+2]));
        const radius=burstRadius*(.18+.82*(delay[i]*2))*depth*flight;
        const sparkX=burstX+Math.cos(angle)*radius;
        const sparkY=burstY+Math.sin(angle)*radius*.82;
        const destX=px,destY=py;
        px=sparkX+(destX-sparkX)*gather;py=sparkY+(destY-sparkY)*gather;
        // Short directional streaks give the launch momentum, then settle into
        // the very same fingerprint points (no replacement particle system).
        const trail=(1-gather)*(1-smooth(releaseAt+200,releaseAt+1000,openingTime))*flight;
        if(ctx&&trail>.03){
          ctx.globalAlpha=openingExposure*trail*.38;ctx.strokeStyle='#a7d8f5';ctx.lineWidth=.65;
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(angle)*trail*14,py-Math.sin(angle)*trail*11);ctx.stroke();
        }
      }
      if(px<0||px>W||py<0||py>H)continue;
      minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
      const hue=(HA[i]+(HB[i]-HA[i])*v+360)%360;
      const sz=Math.max(.65,Math.min(2.6,f*(.75+(i%11)/15)));
      // Every point remains present across the full viewport. The text side is softly lit.
      const light=wide?(rightCopy?.05+.55*(1-smooth(.26,.52,px/W)):.16+.74*smooth(.2,.72,px/W)):.14+.76*(1-smooth(.28,.8,py/H));
      if(wide?px<W*.45:py>H*.45)underText++;
      let textLight=1;
      const chamberDistance=Math.hypot((px-(chamberRect.left+chamberRect.width/2))/(chamberRect.width*.85),(py-(chamberRect.top+chamberRect.height/2))/(chamberRect.height*.9));textLight*=.04+.96*smooth(.45,1.3,chamberDistance);
      if(reading&&px>reading.left-5&&px<reading.right+5&&py>reading.top-5&&py<reading.bottom+5)readingHits++;
      if(!narrative)for(const r of textZones){const dx=Math.max(r.left-px,0,px-r.right),dy=Math.max(r.top-py,0,py-r.bottom);textLight=Math.min(textLight,.025+.975*smooth(20,88,Math.max(dx,dy)));}
      const sparkle=staticMotion?1:.88+.12*Math.sin(time*.001+phases[i]);
      const exposure=narrative?(reduced.matches?.12:1):light*.65;
      paintPoint(px,py,sz*(i%37===0?6:3.6),hue,exposure*textLight*openingExposure*sparkle*.76);
      if(narrative&&previous&&Math.hypot(px-previous[0],py-previous[1])<65){const c=rgb[Math.floor(hue/5)%72];if(gpu)gpu.line(previous[0],previous[1],px,py,...c,openingExposure*(reduced.matches?.12:1)*(1-cameraTravel*.8)*(k===4?.055:.23));else{ctx.globalAlpha=.23*openingExposure*(reduced.matches?.12:1);ctx.strokeStyle=palette[Math.floor(hue/5)%72];ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(...previous);ctx.lineTo(px,py);ctx.stroke();}}previous=[px,py];
      drawn++;
    }
    const glyphs=openingState&&!openingState.complete?0:story?.drawDust(gpu?.dust||ctx,cx,cy,time)||0;
    canvas.dataset.glyphParticles=String(glyphs);canvas.dataset.cameraTravel=cameraTravel.toFixed(3);
    canvas.dataset.cloudBounds=[minX,minY,maxX,maxY].map(n=>n.toFixed(1)).join(',');
    if(ctx){ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}try{gpu?.draw(W,H,D);}catch{canvasFallback();}
    canvas.dataset.readingHits=String(readingHits);canvas.dataset.depthMode='volumetric';canvas.dataset.backend=gpu?'webgl':'canvas';
    const cost=performance.now()-start;frames++;measure+=cost;
    // Adapt once per 90 frames. No new arrays, no particle identity changes.
    if(frames>=90){if(measure/frames>12){active=Math.max(Math.floor(gpu?N*.65:Math.min(N*.55,mobile?2200:3500)),Math.floor(active*.9));}frames=0;measure=0;}
    canvas.dataset.phase=Number.isInteger(target)?'hold':'morph';canvas.dataset.held=String(Number.isInteger(target)&&P===target);
    canvas.dataset.renderer='volumetric-light-field';canvas.dataset.form=names[Math.round(P)];canvas.dataset.formCount='14';canvas.dataset.blackMasks='0';canvas.dataset.filaments=String(narrative?1:0);canvas.dataset.scene=P.toFixed(3);canvas.dataset.target=target.toFixed(3);canvas.dataset.particles=String(active);canvas.dataset.drawn=String(drawn);canvas.dataset.masked='0';canvas.dataset.underText=String(underText);canvas.dataset.frameMs=cost.toFixed(2);canvas.dataset.logoReady=String(logoReady);
    drawing=false;if(!staticMotion)raf=requestAnimationFrame(draw);
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
  addEventListener('mg:story-measured',()=>{updateAnchors();scroll();});
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
    window.MalGuardParticleStory?.reset();scenes[0].classList.remove('in');requestStill();
  }};
  window.addEventListener('pagehide',e=>{if(!e.persisted){cancelAnimationFrame(raf);gpu?.dispose();}});
  window.MalGuardParticles.loseContext=()=>gpu?.loseContext();
  resize();
  // WebKit may finalize fixed-canvas metrics after its initial mobile layout.
  new ResizeObserver(()=>{if(canvas.clientWidth!==W||canvas.clientHeight!==H){resize();requestStill();}}).observe(canvas);
  document.fonts.ready.then(()=>{resize();requestStill();});
})();
