/* GTA Guard's authored inspection gateway. No point field, stock hardware,
   drag controls, remote models, HDR download or post-processing bloom. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

window.createMalGuardGTAScene = async function(host, options = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'low-power' });
  renderer.setClearColor(0x000000,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.91;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(38,1,.1,80);
  const world=new THREE.Group(); scene.add(world);
  const resources=new Set(), own=r=>(resources.add(r),r);
  let disposed=false,frames=0,lastRenderMs=0,badFrames=0;
  let pixelRatio=Math.min(devicePixelRatio||1,options.lite?1.25:1.8);
  const environment=new RoomEnvironment();
  const generator=new THREE.PMREMGenerator(renderer);
  const environmentTarget=own(generator.fromScene(environment,.04));
  scene.environment=environmentTarget.texture; environment.dispose(); generator.dispose();
  scene.add(new THREE.HemisphereLight(0xc6d7e6,0x07101b,.6));
  const key=new THREE.DirectionalLight(0xe4edf4,2.1);key.position.set(-5,7,6);scene.add(key);
  const rim=new THREE.DirectionalLight(0x739bb9,1.8);rim.position.set(5,2,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xc2d8e8,.4);fill.position.set(2,-2,7);scene.add(fill);
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  const scanUniforms={y:{value:2},power:{value:0}};
  function rounded(w,h,r=.18,Path=THREE.Shape){
    const s=new Path(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  }
  function solid(w,h,depth=.12,r=.17){return own(new THREE.ExtrudeGeometry(rounded(w,h,r),{depth,bevelEnabled:true,bevelSegments:options.lite?2:3,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:options.lite?5:9}));}
  function metal(color,roughness=.36){
    const m=own(new THREE.MeshStandardMaterial({color,metalness:.78,roughness,envMapIntensity:.45}));
    m.onBeforeCompile=shader=>{
      shader.uniforms.scanY=scanUniforms.y;shader.uniforms.scanPower=scanUniforms.power;
      shader.vertexShader='varying float vScanY;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvScanY = position.y;');
      shader.fragmentShader='varying float vScanY;\nuniform float scanY;\nuniform float scanPower;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\nfloat scanBand=1.-smoothstep(.014,.1,abs(vScanY-scanY));\ngl_FragColor.rgb+=vec3(.17,.4,.55)*scanBand*scanPower;');
    };m.customProgramCacheKey=()=> 'mg-gateway-geometry-scan-v2';return m;
  }
  const graphite=metal('#1c2530',.43),silver=metal('#34404b',.29),dark=metal('#131c25',.46);
  const cool=own(new THREE.MeshBasicMaterial({color:'#86c5f0',transparent:true,opacity:.7}));
  const amber=own(new THREE.MeshBasicMaterial({color:'#dab788',transparent:true,opacity:.75}));
  const glass=own(new THREE.MeshPhysicalMaterial({color:'#5082a5',metalness:.16,roughness:.2,clearcoat:1,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));
  function mesh(geo,mat,parent=world,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
  const gates=new THREE.Group();world.add(gates);
  const gateShape=rounded(5.4,3.85,.17);gateShape.holes.push(rounded(5.02,3.47,.10,THREE.Path));
  const gateGeometry=own(new THREE.ExtrudeGeometry(gateShape,{depth:.3,bevelEnabled:true,bevelSize:.018,bevelThickness:.025,bevelSegments:options.lite?2:3,curveSegments:options.lite?5:9}));
  const gateFrames=[],guides=[];
  const innerShape=rounded(5.10,3.55,.12);
  const innerGeometry=own(new THREE.BufferGeometry().setFromPoints(innerShape.getPoints(72).map(p=>new THREE.Vector3(p.x,p.y,.33))));
  for(let i=0;i<4;i++){
    const frame=new THREE.Group();frame.position.z=-i*.73;
    mesh(gateGeometry,i===0?silver:graphite,frame);
    const line=new THREE.LineLoop(innerGeometry,own(new THREE.LineBasicMaterial({color:i===3?'#7a95f3':'#85c5e9',transparent:true,opacity:.55-i*.09})));frame.add(line);
    gates.add(frame);gateFrames.push(frame);guides.push(line);
  }
  // Shared repeating geometry keeps the precisely machined rails inexpensive.
  const railGeometry=own(new THREE.BoxGeometry(.085,.085,3.1));
  for(const x of [-2.45,2.45])for(const y of [-1.7,1.7])mesh(railGeometry,dark,gates,x,y,-1.25);
  // A fictional night-city perimeter gives the opening its game/mod context.
  // It is authored geometry, not footage or a playable recreation of GTA V.
  const city=new THREE.Group();world.add(city);city.position.set(0,-1.9,-4.3);
  const cityMaterial=own(new THREE.MeshStandardMaterial({color:'#1e3448',metalness:.55,roughness:.58,transparent:true,opacity:1}));
  const buildingGeometry=own(new THREE.BoxGeometry(1,1,1));
  const buildingCount=42,buildings=new THREE.InstancedMesh(buildingGeometry,cityMaterial,buildingCount),cityMatrix=new THREE.Matrix4();
  const cPos=new THREE.Vector3(),cScale=new THREE.Vector3(),cQuat=new THREE.Quaternion();
  for(let i=0;i<buildingCount;i++){
    const col=i%7,row=Math.floor(i/7),height=.38+((i*17+11)%19)*.135;
    cPos.set((col-3)*.82+(col<3?-.4:.4),height/2,-row*.74);cScale.set(.45+((i*3)%5)*.045,height,.48);cityMatrix.compose(cPos,cQuat,cScale);buildings.setMatrixAt(i,cityMatrix);
  }city.add(buildings);
  const roadMaterial=own(new THREE.MeshBasicMaterial({color:'#406d99',transparent:true,opacity:.7}));
  const roadGeometry=own(new THREE.BoxGeometry(.028,.014,6.7));
  for(const x of [-.28,.28])mesh(roadGeometry,roadMaterial,city,x,.017,-1.8);
  const avenues=new THREE.InstancedMesh(own(new THREE.BoxGeometry(7.3,.014,.025)),roadMaterial,6);
  for(let i=0;i<6;i++){cityMatrix.makeTranslation(0,.017,-i*.74+.4);avenues.setMatrixAt(i,cityMatrix);}city.add(avenues);
  const windows=new THREE.InstancedMesh(own(new THREE.BoxGeometry(.035,.015,.015)),own(new THREE.MeshBasicMaterial({color:'#a5bdd7',transparent:true,opacity:.65})),168);
  for(let i=0;i<168;i++){const b=Math.floor(i/4),col=b%7,row=Math.floor(b/7),h=.38+((b*17+11)%19)*.135;cityMatrix.makeTranslation((col-3)*.82+(col<3?-.4:.4)+(i%2)*.12-.06,h*(.25+Math.floor(i%4/2)*.4),-row*.74+.25);windows.setMatrixAt(i,cityMatrix);}city.add(windows);
  const boundary=new THREE.Group();world.add(boundary);boundary.position.z=-2.6;
  mesh(own(new THREE.PlaneGeometry(4.72,3.18)),own(new THREE.MeshBasicMaterial({color:'#0a1524',transparent:true,opacity:.12,side:THREE.DoubleSide})),boundary);
  const ticksGeometry=own(new THREE.BoxGeometry(.1,.025,.05));
  const ticks=new THREE.InstancedMesh(ticksGeometry,silver,28),matrix=new THREE.Matrix4();
  for(let i=0;i<28;i++){matrix.makeTranslation(-2.23+i*.166,-1.82,.22);ticks.setMatrixAt(i,matrix);}gates.add(ticks);
  const leftDoor=new THREE.Group(),rightDoor=new THREE.Group();
  world.add(leftDoor,rightDoor);
  const doorGeometry=solid(2.43,3.25,.17,.16);
  mesh(doorGeometry,graphite,leftDoor);mesh(doorGeometry,graphite,rightDoor);
  mesh(own(new THREE.BoxGeometry(.023,2.6,.03)),cool,leftDoor,1.15,0,.21);
  mesh(own(new THREE.BoxGeometry(.023,2.6,.03)),cool,rightDoor,-1.15,0,.21);
  const file=new THREE.Group();world.add(file);
  const fileGeometry=solid(2.65,2.06,.17,.14);
  const front=mesh(fileGeometry,dark,file,0,0,.05);
  const rimShape=rounded(2.6,2.01,.14),fileEdgeGeometry=own(new THREE.BufferGeometry().setFromPoints(rimShape.getPoints(56).map(p=>new THREE.Vector3(p.x,p.y,.25))));
  file.add(new THREE.LineLoop(fileEdgeGeometry,own(new THREE.LineBasicMaterial({color:'#94b4d0',transparent:true,opacity:.43}))));
  await Promise.allSettled([document.fonts.load('500 30px "JetBrains Mono"'),document.fonts.load('500 50px Sora')]);
  function texture(title,subtitle,kind=0){
    const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d');
    ctx.font='500 24px "JetBrains Mono",monospace';ctx.fillStyle='#bbd5e8';ctx.fillText(title,58,78);
    ctx.strokeStyle='#739abc66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(58,112);ctx.lineTo(940,112);ctx.stroke();
    ctx.font='400 27px Inter,sans-serif';ctx.fillStyle=kind===3?'#edd1a4':'#d6e8f7';ctx.fillText(subtitle,58,640);
    ctx.font='400 19px "JetBrains Mono",monospace';ctx.fillStyle='#aec6db';ctx.fillText('ILLUSTRATIVE / STATIC EVIDENCE',58,696);
    if(kind){
      const lines=[['FORMAT  /  PE x64','SECTION / .text','SIZE    / bounded intake'],['IMPORTS / static structure','ENTRY   / not executed','MEMBER  / encrypted'],['EVIDENCE  / unavailable','COVERAGE  / incomplete','DECISION  / Inconclusive']][Math.min(2,kind-1)];
      ctx.font='400 27px "JetBrains Mono",monospace';lines.forEach((line,i)=>{ctx.fillStyle=i===2&&kind>1?'#dfc39b':'#b8d3eb';ctx.fillText(line,58,220+i*80);});
      for(let i=0;i<12;i++){ctx.fillStyle=i%3===0?'#b8dcf86b':'#639ab341';ctx.fillRect(58+i*67,520,38,4+(i%4)*9);}
    }
    const t=own(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(options.lite?2:8,renderer.capabilities.getMaxAnisotropy());return t;
  }
  function pane(t,w,h,parent,z,opacity=1){return mesh(own(new THREE.PlaneGeometry(w,h)),own(new THREE.MeshBasicMaterial({map:t,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide})),parent,0,0,z);}
  const fileFace=pane(texture('MALGUARD / GTA GUARD','vehicle_pack.dll'),2.56,1.92,file,.254);
  let emblem;
  try{
    const img=new Image();img.src=document.querySelector('.mg-brand img').src;await img.decode();
    const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(img,0,0,512,512);
    const logo=own(new THREE.CanvasTexture(c));logo.colorSpace=THREE.SRGBColorSpace;
    emblem=pane(logo,.58,.58,file,.26);emblem.position.y=.04;
  }catch{}
  const layers=[],layerGeometry=solid(2.5,1.9,.075,.12);
  for(let i=0;i<3;i++){
    const group=new THREE.Group();mesh(layerGeometry,i===2?dark:graphite,group);
    pane(texture(['01 / IDENTITY','02 / STRUCTURE','03 / COVERAGE'][i],['SUPPORTED FORMAT','STATIC MEMBERS','INCOMPLETE EVIDENCE'][i],i+1),2.38,1.78,group,.11);
    layers.push(group);world.add(group);
  }
  const sheet=mesh(own(new THREE.PlaneGeometry(4.6,2.95)),glass,world,0,0,.4);
  const scanBeam=new THREE.Group();world.add(scanBeam);
  const beamMaterial=own(new THREE.MeshBasicMaterial({color:'#a0dcff',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  const scanPlane=mesh(own(new THREE.PlaneGeometry(5.1,3.7)),beamMaterial,scanBeam,0,0,-.6);scanPlane.rotation.x=-Math.PI/2;
  const beamLine=mesh(own(new THREE.BoxGeometry(4.65,.009,.02)),own(new THREE.MeshBasicMaterial({color:'#ceefff',transparent:true,opacity:0})),scanBeam,0,0,1.26);
  const evidence=new THREE.Group();world.add(evidence);
  const tileGeometry=solid(1.72,.73,.075,.09),tiles=[];
  const positions=[[-1.3,1.25,.5],[1.45,.9,.35],[-1.32,-.95,.4],[1.32,-.85,.75]];
  for(let i=0;i<4;i++){
    const g=new THREE.Group();mesh(tileGeometry,graphite,g);
    const c=document.createElement('canvas');c.width=512;c.height=220;const ctx=c.getContext('2d');
    ctx.font='500 26px "JetBrains Mono",monospace';ctx.fillStyle=i===3?'#e6c499':'#c1daef';ctx.fillText(['FORMAT / x64','STATIC IMPORTS','LOADER PATTERN','EVIDENCE GAP'][i],28,65);
    ctx.font='400 23px Inter,sans-serif';ctx.fillStyle='#b5cee3';ctx.fillText(['Identity established','Structure examined','Attribution uncertain','Encrypted member'][i],28,123);
    ctx.fillStyle=i===3?'#c9a87566':'#95cef052';ctx.fillRect(28,172,418,2);
    const t=own(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;
    pane(t,1.6,.65,g,.12);g.position.set(...positions[i]);g.rotation.z=(i%2?1:-1)*.045;evidence.add(g);tiles.push(g);
  }
  const connections=[];
  for(let i=0;i<4;i++){
    const [x,y,z]=positions[i],curve=new THREE.CubicBezierCurve3(new THREE.Vector3(0,0,.4),new THREE.Vector3(x*.1,y,.4),new THREE.Vector3(x*.9,y*.3,z),new THREE.Vector3(x,y,z));
    const geo=own(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)));
    const line=new THREE.Line(geo,own(new THREE.LineBasicMaterial({color:i===3?'#c2a681':'#79bdea',transparent:true,opacity:.6})));evidence.add(line);connections.push(line);
  }
  const packetsGeometry=own(new THREE.BoxGeometry(.095,.04,.04));
  const packets=new THREE.InstancedMesh(packetsGeometry,cool,12);evidence.add(packets);
  const report=new THREE.Group();world.add(report);
  mesh(solid(3.2,2.28,.14,.16),dark,report);
  const reportFace=pane(texture('04 / DECIDE','INCONCLUSIVE',3),3.08,2.17,report,.21);
  const reportRule=mesh(own(new THREE.BoxGeometry(2.82,.018,.02)),amber,report,0,-.91,.23);
  // Atmospheric reflections are shaped planes, not a bright layer under copy.
  const floorCanvas=document.createElement('canvas');floorCanvas.width=256;floorCanvas.height=128;
  const fc=floorCanvas.getContext('2d');fc.scale(1,.5);const grad=fc.createRadialGradient(128,128,2,128,128,126);grad.addColorStop(0,'#487d9b39');grad.addColorStop(1,'#26324b00');fc.fillStyle=grad;fc.fillRect(0,0,256,256);
  const floor=mesh(own(new THREE.PlaneGeometry(6.5,1.5)),own(new THREE.MeshBasicMaterial({map:own(new THREE.CanvasTexture(floorCanvas)),transparent:true,depthWrite:false})),world,0,-2.25,-.6);
  let width=1,height=1;
  function resize(){if(disposed)return;const r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  function draw(s){
    if(disposed)return;
    const compact=s.compact,aspect=width/height;
    camera.setViewOffset(width,height,-width*(compact?0:.26)*s.shift,height*(compact?.21:0),width,height);
    camera.position.set(s.cameraX,s.cameraY,s.cameraZ+(compact?3:0));camera.lookAt(0,0,-.45);
    const scale=compact?Math.min(.80,Math.max(.52,(height-500)/850)):Math.min(.82,aspect/1.9);
    world.scale.setScalar(scale*(1-s.explode*.1));world.rotation.set(.04,-.09+s.turn,-.025);
    const gateOpen=s.door;
    for(let i=0;i<4;i++){gateFrames[i].position.z=-i*(.73+s.depth*.38);gateFrames[i].rotation.z=(i-1.5)*s.turn*.07;guides[i].material.opacity=.2+s.light*.36-(i*.032);}
    city.visible=s.city>.003;cityMaterial.opacity=s.city;roadMaterial.opacity=s.city*.55;windows.material.opacity=s.city*.6;
    boundary.visible=s.report<.8;
    leftDoor.position.set(-1.23-gateOpen*2.7,0,.31-gateOpen*.35);rightDoor.position.set(1.23+gateOpen*2.7,0,.31-gateOpen*.35);
    leftDoor.rotation.y=-gateOpen*.45;rightDoor.rotation.y=gateOpen*.45;
    leftDoor.visible=rightDoor.visible=gateOpen<.985;
    file.position.set(0,Math.sin(s.seconds*.6)*.015*(1-s.arrival),2.9-s.arrival*2.1+s.fileFlight*.6);
    file.rotation.y=-.18+s.turn*.6;file.rotation.x=.035;
    file.scale.setScalar((.9+s.arrival*.1)*(1-s.connections*.50));file.visible=s.report<.83;
    file.position.y+=s.connections*.15;
    fileFace.material.opacity=1-s.explode*.82;
    if(emblem)emblem.material.opacity=s.logo*(1-s.explode*.65);
    for(let i=0;i<3;i++){
      const layer=layers[i];layer.visible=s.explode>.01&&i!==1;
      layer.position.set((i-1)*s.explode*.8,(i-1)*s.explode*.3,(i-1)*s.explode*.83+.4);
      layer.rotation.set(-s.explode*.04,-s.explode*.17,0);layer.scale.setScalar(.98);
    }
    scanUniforms.y.value=1.7-s.scan*3.4;scanUniforms.power.value=s.scanOpacity;
    scanBeam.position.y=scanUniforms.y.value;scanBeam.visible=s.scanOpacity>.002;
    beamMaterial.opacity=s.scanOpacity*.035;beamLine.material.opacity=s.scanOpacity*.55;
    sheet.material.opacity=.05+s.light*.055;sheet.visible=s.report<.6;
    evidence.visible=s.connections>.005;
    for(let i=0;i<4;i++){
      const a=smooth((s.connections-i*.055)/.8),[x,y,z]=positions[i];tiles[i].scale.setScalar(.5+a*.5);tiles[i].position.set(x*a,y*a,z);connections[i].geometry.setDrawRange(0,Math.floor(a*49));
    }
    for(let i=0;i<12;i++){
      const line=i%4,k=clamp((s.evidenceFlow-i*.026)%1),[x,y,z]=positions[line];
      matrix.makeTranslation(x*k,y*k,.4+(z-.4)*k);packets.setMatrixAt(i,matrix);
    }packets.instanceMatrix.needsUpdate=true;
    report.visible=s.report>.01;report.scale.setScalar(.65+s.report*.35);report.position.set(0,0,1.2+s.dive*2.0);
    report.rotation.y=-.18*(1-s.dive);reportFace.material.opacity=s.report;reportRule.material.opacity=s.report*.85;
    floor.material.opacity=(1-s.dive)*.65;
    const t=performance.now();renderer.render(scene,camera);lastRenderMs=performance.now()-t;frames++;
    if(lastRenderMs>28)badFrames++;else badFrames=Math.max(0,badFrames-1);
    if(badFrames>7&&pixelRatio>1){pixelRatio=1;resize();badFrames=0;}
  }
  const lost=e=>{e.preventDefault();if(!disposed)options.onContextLost?.();};renderer.domElement.addEventListener('webglcontextlost',lost);
  function dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lost);resources.forEach(r=>r.dispose());resources.clear();renderer.dispose();renderer.domElement.remove();scene.clear();}
  function metrics(){
    world.updateMatrixWorld(true);const box=new THREE.Box3();
    [gates,file,...layers.filter(g=>g.visible),evidence,report].filter(g=>g.visible).forEach(g=>box.expandByObject(g));
    const pts=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);pts.push({x:(p.x+1)*width/2,y:(1-p.y)*height/2});}
    return{frames,lastRenderMs,pixelRatio,authenticLogo:Boolean(emblem),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:[camera.position.x,camera.position.y,camera.position.z],bounds:{left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))}};
  }
  try{resize();await renderer.compileAsync(scene,camera);if(!disposed)host.append(renderer.domElement);return{draw,resize,dispose,metrics,loseContext:()=>renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext()};}catch(e){dispose();throw e;}
};
