/* A light, CPU projection of the original aperture. The real SVG outlines,
   depth, camera and scene clock are shared with the WebGL presentation. */
import originalLogo from './assets/malguard-logo.svg';

window.createMalGuardHomeProjection=function(host,options={}){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return null;
  canvas.className='opening-projection';canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const faces=[];let W=1,H=1,D=1,disposed=false,last=-Infinity,frames=0,renderMs=0;
  const mix=(a,b,t)=>a+(b-a)*t;
  const add=(points,color,group='fixed',id=0,alpha=1)=>faces.push({points,color,group,id,alpha});
  const spin=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
  const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
  function box(w,h,d,color,group,id,x=0,y=0,z=0,a=0){
    const p=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]].map(v=>{const q=spin(v,a);return[q[0]+x,q[1]+y,q[2]+z];});
    for(const side of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])add(side.map(i=>p[i]),color,group,id);
  }
  const hex=(r,z)=>Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+Math.PI/6;return[Math.cos(a)*r,Math.sin(a)*r,z];});
  for(let layer=0;layer<4;layer++){
    const inner=hex(2.58-layer*.12,0),outer=hex(2.76-layer*.12,0),color=layer===0?'#6b8495':'#233442';
    for(let i=0;i<6;i++){
      const j=(i+1)%6,front=p=>[p[0],p[1],.12];
      add([front(outer[i]),front(outer[j]),front(inner[j]),front(inner[i])],color,'frame',layer);
      add([outer[j],outer[i],inner[i],inner[j]],color,'frame',layer);
      add([outer[i],outer[j],front(outer[j]),front(outer[i])],color,'frame',layer);
      add([inner[j],inner[i],front(inner[i]),front(inner[j])],color,'frame',layer);
    }
  }
  for(let i=0;i<6;i++){
    box(.075,1.13,.07,'#6b8495','blade',i,0,2.45,.32);
    box(.017,.78,.022,'#8db9d4','blade',i,.06,2.45,.4);
    box(.29,.038,.14,'#233442','blade',i,0,2.76,.35);
  }
  // The project SVG contains line contours. Preserve every authored contour,
  // including counters and both colors; do not invent a replacement mark.
  const svg=new DOMParser().parseFromString(originalLogo,'image/svg+xml');
  for(const path of svg.querySelectorAll('path')){
    const color=path.getAttribute('fill');
    for(const contour of path.getAttribute('d').split(/Z/i)){
      const xy=contour.match(/-?\d+(?:\.\d+)?/g)?.map(Number);if(!xy||xy.length<6)continue;
      const p=[];for(let i=0;i<xy.length;i+=2)p.push([(xy[i]-180)*.011,(178-xy[i+1])*.011,0]);
      const front=p.map(v=>[v[0],v[1],.132]);
      add(front.slice().reverse(),color,'logo');add(p,color,'logo');
      for(let i=0;i<p.length;i++){const j=(i+1)%p.length;add([p[j],p[i],front[i],front[j]],color,'logo');}
    }
  }
  for(let i=0;i<36;i++){const a=i*Math.PI/18;box(.034,i%3===0?.12:.045,.025,'#8db9d4','rail',0,Math.cos(a)*3.14,Math.sin(a)*3.14,-.55,a-Math.PI/2);}
  for(let i=0;i<24;i++){const a=Math.floor(i/4)*Math.PI/3+Math.PI/6,r=2.69-i%4*.12;box(.018,.018,.96,'#38586d','fixed',0,Math.cos(a)*r,Math.sin(a)*r,-.55);}
  add([[-1.775,-.006,0],[1.775,-.006,0],[1.775,.006,.25],[-1.775,.006,.25]],'#b9e6fa','scan');
  const key=norm([-5,6,4]),edge=norm([6,1,-3]);
  function resize(){W=Math.max(1,host.clientWidth);H=Math.max(1,host.clientHeight);D=Math.min(devicePixelRatio||1,options.lite?1:1.5);canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);last=-Infinity;}
  function draw(s){
    if(disposed)return;const now=performance.now();if(W!==host.clientWidth||H!==host.clientHeight)resize();
    if(now-last<(options.lite?30:14)&&s.elapsed!==0)return;last=now;
    const open=s.open||0,burst=s.fragments||0,turn=s.quantumTurn||0,energy=s.quantumEnergy||0;
    const camera=[mix(4.7,.18,open),mix(1.1,.22,open),mix(4.45,W>900?12.6:15.7,open)];
    const forward=norm(camera.map(v=>-v)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),f=H/(2*Math.tan(Math.PI/10));
    const rx=mix(.04,-.02,open),ry=mix(-.25,.04,open),rz=turn*.54;
    const world=p=>{const q=spin(p,rz),x=q[0]*Math.cos(ry)+q[2]*Math.sin(ry),z=-q[0]*Math.sin(ry)+q[2]*Math.cos(ry);return[x,q[1]*Math.cos(rx)-z*Math.sin(rx),q[1]*Math.sin(rx)+z*Math.cos(rx)];};
    function pose(p,face){
      let q=p.slice();const i=face.id;
      if(face.group==='frame'){const delayed=Math.min(1,Math.max(0,(open-i*.085)/.74));q=spin(q,(1-delayed)*.045*(i-1.5)+turn*.16+burst*(i-1.5)*.035);q[0]+=(i-1.5)*burst*.075;q[2]-=i*(.1+delayed*.48)+burst*(.28+i*.11);}
      if(face.group==='blade'){const a=i*Math.PI/3,spread=burst*(.42+i%3*.08);q=spin(q,a+(1-open)*.11+turn*.27);q[0]+=Math.sin(a)*(open*.43+spread);q[1]+=Math.cos(a)*(open*.43+spread);q[2]+=open*.16+burst*.24;}
      if(face.group==='logo'){const scale=(1+energy*.1)*(1-burst*.75);q=q.map(v=>v*scale);q[2]+=mix(-.45,.32,open)+burst*.2;}
      if(face.group==='rail')q=spin(q,mix(-.14,0,open));
      if(face.group==='scan'){q[1]+=1.82-(s.scan||0)*3.64;q[2]+=.32;}
      return world(q);
    }
    const project=p=>{const v=p.map((x,i)=>x-camera[i]),z=dot(v,forward);return[W*(s.portalX??.67)+dot(v,right)*f/z,H*(s.portalY??.48)-dot(v,up)*f/z,z];};
    const projected=faces.map(face=>{const verts=face.points.map(p=>pose(p,face)),screen=verts.map(project);const n=norm(cross(verts[1].map((v,i)=>v-verts[0][i]),verts[2].map((v,i)=>v-verts[0][i])));return{face,verts,screen,n,z:screen.reduce((sum,p)=>sum+p[2],0)/screen.length};}).filter(x=>x.screen.every(p=>p[2]>.1)).sort((a,b)=>b.z-a.z);
    ctx.setTransform(D,0,0,D,0,0);ctx.clearRect(0,0,W,H);
    for(const {face,screen,n}of projected){
      const alpha=face.group==='logo'?(s.logo||0)*(1-burst):face.group==='scan'?(s.beam||0)*.65:face.alpha;if(alpha<.005)continue;
      const rgb=face.color.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)),light=.43+Math.max(0,dot(n,key))*.64+Math.max(0,dot(n,edge))*.20;
      ctx.globalAlpha=alpha;ctx.fillStyle=`rgb(${rgb.map(v=>Math.min(255,Math.round(v*light))).join(',')})`;ctx.beginPath();screen.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;frames++;renderMs=performance.now()-now;
  }
  resize();return{draw,resize,metrics:()=>({frames,frameMs:renderMs,faces:faces.length,authenticLogo:svg.querySelectorAll('path').length===2,model:'MalGuard evidence aperture projection'}),dispose(){disposed=true;canvas.remove();}};
};
