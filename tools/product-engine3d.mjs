import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Real meshes, a perspective camera and physically based materials. No SVG piston fallback.
export async function mountEngine3D(container){
 const canvas=document.createElement('canvas');canvas.className='engine3d-canvas';canvas.setAttribute('aria-hidden','true');container.append(canvas);
 let renderer;
 try{const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});if(!context){canvas.remove();container.dataset.renderState='poster';return null;}renderer=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});}catch{canvas.remove();container.dataset.renderState='poster';return null;}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
 renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<600?1.35:1.6));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,50);
 camera.position.set(3.5,2.7,6);camera.lookAt(0,.33,0);
 const rig=new THREE.Group();scene.add(rig);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.85;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xcce2ff,0x292533,.8));
 const key=new THREE.DirectionalLight(0xfff3e5,2.8);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.near=.5;key.shadow.camera.far=15;key.shadow.normalBias=.015;key.shadow.bias=-.0002;scene.add(key);
 const rim=new THREE.DirectionalLight(0x7bbcff,2.1);rim.position.set(3,2,-3);scene.add(rim);
 const warm=new THREE.DirectionalLight(0xffc18a,.9);warm.position.set(-3,1,-2);scene.add(warm);
 const steel=new THREE.MeshStandardMaterial({color:0xb6c0cb,metalness:1,roughness:.23});
 const satin=new THREE.MeshStandardMaterial({color:0x8e9cab,metalness:.9,roughness:.3});
 const dark=new THREE.MeshStandardMaterial({color:0x172431,metalness:.82,roughness:.28});
 const black=new THREE.MeshStandardMaterial({color:0x11161d,metalness:.7,roughness:.33});
 const bronze=new THREE.MeshStandardMaterial({color:0x9b7048,metalness:.92,roughness:.25});
 const ringMat=new THREE.MeshStandardMaterial({color:0x272d35,metalness:.93,roughness:.25});
 const liner=new THREE.MeshStandardMaterial({color:0x75899d,metalness:.95,roughness:.23,side:THREE.DoubleSide});
 const geometryCache=new Map();
 const cylinder=(r,h,segments=48)=>{const k=`c${r}/${h}/${segments}`;if(!geometryCache.has(k))geometryCache.set(k,new THREE.CylinderGeometry(r,r,h,segments));return geometryCache.get(k);};
 const mesh=(geometry,material,parent=rig)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=!material.transparent;m.receiveShadow=!material.transparent;parent.add(m);return m;};
 const box=(x,y,z,material,parent=rig,r=.015)=>mesh(new RoundedBoxGeometry(x,y,z,2,r),material,parent);
 const axle=(r,length,material,parent=rig)=>{const m=mesh(cylinder(r,length),material,parent);m.rotation.z=Math.PI/2;return m;};
 const ring=(r,t,material,parent=rig)=>{const m=mesh(new THREE.TorusGeometry(r,t,8,48),material,parent);m.rotation.x=Math.PI/2;return m;};
 const bolt=(x,y,z,parent=rig)=>{const b=mesh(cylinder(.035,.035,6),steel,parent);b.position.set(x,y,z);const inset=mesh(cylinder(.014,.002,6),black,parent);inset.position.set(x,y+.019,z);};
 // Grounded crankcase frame, deck and rear cooling ribs.
 box(3.43,.14,1.18,dark).position.y=-.86;
 box(3.12,.09,.13,satin).position.set(0,-.67,.42);
 box(3.12,.09,.13,dark).position.set(0,-.67,-.42);
 for(const x of [-1.53,1.53]){box(.12,1.66,.13,dark).position.set(x,.05,-.38);box(.12,.48,.12,satin).position.set(x,-.56,.25);bolt(x,-.77,.43);bolt(x,-.77,-.43);}
 for(const y of [.22,.37,.52,.67,.82])box(3.06,.027,.11,dark).position.set(0,y,-.46);
 const deckShape=new THREE.Shape();deckShape.moveTo(-1.5,-.36);deckShape.lineTo(1.5,-.36);deckShape.lineTo(1.5,.36);deckShape.lineTo(-1.5,.36);deckShape.closePath();
 const centers=[-.99,-.33,.33,.99];
 for(const x of centers){const hole=new THREE.Path();hole.absarc(x,0,.267,0,Math.PI*2,true);deckShape.holes.push(hole);}
 const deck=mesh(new THREE.ExtrudeGeometry(deckShape,{depth:.065,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:32}),dark);deck.rotation.x=Math.PI/2;deck.position.y=.99;
 for(const x of [-1.38,1.38])for(const z of [-.27,.27])bolt(x,1.008,z);
 const labels=document.createElement('canvas');labels.width=1024;labels.height=96;
 const labelContext=labels.getContext('2d');labelContext.fillStyle='#afc2d1';labelContext.font='500 28px Arial';labelContext.textAlign='center';labelContext.textBaseline='middle';
 ['LINK','FILE','AI','AGENT'].forEach((label,i)=>labelContext.fillText(label,128+i*256,48));
 const labelTexture=new THREE.CanvasTexture(labels);labelTexture.colorSpace=THREE.SRGBColorSpace;
 const nameplate=mesh(new THREE.PlaneGeometry(2.64,.10),new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false}));nameplate.position.set(0,-.855,.597);nameplate.castShadow=false;
 const shaft=axle(.058,3.23,steel);shaft.position.y=-.35;
 for(const x of [-1.47,1.47]){const bearing=axle(.12,.10,bronze);bearing.position.set(x,-.35,0);const support=box(.14,.37,.17,dark);support.position.set(x,-.59,0);}
 // Beveled, drilled crank webs and a toothed flywheel are solid geometry.
 const webShape=new THREE.Shape();webShape.absellipse(0,0,.19,.27,0,Math.PI*2,false);
 const cutout=new THREE.Path();cutout.absarc(0,-.12,.07,0,Math.PI*2,true);webShape.holes.push(cutout);
 const webGeometry=new THREE.ExtrudeGeometry(webShape,{depth:.055,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:2,curveSegments:28});
 const flyShape=new THREE.Shape();for(let i=0;i<96;i++){const a=i/96*Math.PI*2,r=i%4===0||i%4===3?.39:.415;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)flyShape.moveTo(x,y);else flyShape.lineTo(x,y);}flyShape.closePath();
 const bore=new THREE.Path();bore.absarc(0,0,.10,0,Math.PI*2,true);flyShape.holes.push(bore);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2,h=new THREE.Path();h.absarc(Math.cos(a)*.26,Math.sin(a)*.26,.045,0,Math.PI*2,true);flyShape.holes.push(h);}
 const fly=new THREE.Group();rig.add(fly);fly.position.set(-1.67,-.35,0);
 const flyMesh=mesh(new THREE.ExtrudeGeometry(flyShape,{depth:.09,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:2,curveSegments:20}),satin,fly);flyMesh.rotation.y=Math.PI/2;flyMesh.position.x=-.045;
 const hub=axle(.13,.145,steel,fly);hub.position.x=.01;
 // One piston design, including hollow skirt, crown bevel, wrist pin and compression rings.
 const pistonProfile=[new THREE.Vector2(.218,-.25),new THREE.Vector2(.239,-.235),new THREE.Vector2(.246,-.20),new THREE.Vector2(.246,.095),new THREE.Vector2(.239,.13),new THREE.Vector2(.225,.145),new THREE.Vector2(0,.145),new THREE.Vector2(0,.119),new THREE.Vector2(.207,.119),new THREE.Vector2(.207,-.23),new THREE.Vector2(.218,-.25)];
 const pistonGeometry=new THREE.LatheGeometry(pistonProfile,64);
 const helix=new THREE.CatmullRomCurve3(Array.from({length:101},(_,i)=>{const a=i/100*Math.PI*10;return new THREE.Vector3(Math.cos(a)*.038,i/100*.22,Math.sin(a)*.038);}));
 const springGeometry=new THREE.TubeGeometry(helix,100,.0055,5,false);
 const units=[];const phases=[0,Math.PI,Math.PI*3,Math.PI*2];
 centers.forEach((x,i)=>{
  const group=new THREE.Group();group.position.x=x;rig.add(group);
  // Rear half of a bore leaves a real open cutaway, rather than a painted cylinder.
  const wallProfile=[new THREE.Vector2(.285,-.43),new THREE.Vector2(.285,.43),new THREE.Vector2(.258,.43),new THREE.Vector2(.258,-.43),new THREE.Vector2(.285,-.43)];
  const sleeve=mesh(new THREE.LatheGeometry(wallProfile,64,Math.PI/2,Math.PI),liner,group);sleeve.position.y=.48;
  for(const sx of [-.2715,.2715])box(.027,.86,.005,steel,group,.001).position.set(sx,.48,.002);
  for(const y of [.05,.91]){const lip=mesh(new THREE.TorusGeometry(.278,.013,8,48,Math.PI),satin,group);lip.rotation.x=-Math.PI/2;lip.position.y=y;}
  for(const sx of [-.278,.278])mesh(cylinder(.009,.86,12),satin,group).position.set(sx,.48,0);
  const crank=new THREE.Group();group.add(crank);crank.position.y=-.35;
  for(const dx of [-.115,.07]){const web=mesh(webGeometry,satin,crank);web.rotation.y=Math.PI/2;web.position.x=dx;}
  const pin=axle(.058,.21,steel,crank);pin.position.y=.22;
  const piston=new THREE.Group();group.add(piston);mesh(pistonGeometry,steel,piston);
  for(const y of [.085,.04,-.005])ring(.246,.006,ringMat,piston).position.y=y;
  axle(.039,.50,bronze,piston).position.y=0;
  const rod=new THREE.Group();group.add(rod);
  box(.045,.54,.075,satin,rod,.008);
  for(const dx of [-.025,.025])box(.012,.52,.09,steel,rod,.006).position.x=dx;
  for(const [y,r,t]of [[-.35,.079,.024],[.35,.047,.018]]){const eye=mesh(new THREE.TorusGeometry(r,t,10,40),steel,rod);eye.rotation.y=Math.PI/2;eye.position.y=y;const liner=mesh(new THREE.TorusGeometry(r-.011,.009,8,40),bronze,rod);liner.rotation.y=Math.PI/2;liner.position.y=y;}
  for(const z of [-.055,.055]){const cap=axle(.019,.095,steel,rod);cap.position.set(0,-.30,z);}
  const gasMaterial=new THREE.MeshBasicMaterial({color:0x71c4f3,transparent:true,opacity:.065,depthWrite:false});
  const gas=mesh(new THREE.CylinderGeometry(.219,.219,1,48),gasMaterial,group);gas.castShadow=false;gas.renderOrder=1;
  const valves=[];
  for(const side of [-1,1]){
   const stem=new THREE.Group();group.add(stem);stem.position.x=side*.10;
   mesh(cylinder(.009,.35,16),steel,stem).position.y=1.085;
   const plate=mesh(new THREE.CylinderGeometry(.055,.048,.018,32),satin,stem);plate.position.y=.92;
   mesh(cylinder(.052,.016,32),steel,stem).position.y=1.245;
   const spring=new THREE.Group();group.add(spring);spring.position.set(side*.10,1.015,0);mesh(springGeometry,steel,spring);
   mesh(cylinder(.055,.013,32),dark,group).position.set(side*.1,1.007,0);
   valves.push({stem,spring});
  }
  units.push({x,group,crank,piston,rod,gas,gasMaterial,valves,phase:phases[i],slider:0,angle:0});
 });
 // Soft studio grounding is a tiny locally generated texture, not a post-processing pass.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');const g=ctx.createRadialGradient(64,64,10,64,64,63);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const shadow=mesh(new THREE.PlaneGeometry(4.1,2.0),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.945;shadow.castShadow=false;
 const yAxis=new THREE.Vector3(0,1,0),top=new THREE.Vector3(),bottom=new THREE.Vector3(),direction=new THREE.Vector3();
 const intakeColor=new THREE.Color(0x63bdf0),powerColor=new THREE.Color(0xffac55),compressionColor=new THREE.Color(0xb8cde0),exhaustColor=new THREE.Color(0x8e9fb5);
 function apply(time){
  const angle=time*Math.PI*2/3.4;fly.rotation.x=angle;
  for(const u of units){
   const a=angle+u.phase,pinY=-.35+.22*Math.cos(a),pinZ=.22*Math.sin(a),slider=pinY+Math.sqrt(.7*.7-pinZ*pinZ);
   u.slider=slider;u.angle=a;u.crank.rotation.x=a;u.piston.position.y=slider;
   top.set(0,slider,0);bottom.set(0,pinY,pinZ);u.rod.position.copy(top).add(bottom).multiplyScalar(.5);direction.copy(top).sub(bottom).normalize();u.rod.quaternion.setFromUnitVectors(yAxis,direction);
   const cycle=((a%(Math.PI*4))+Math.PI*4)%(Math.PI*4),stroke=cycle/Math.PI;
   const inlet=stroke<1?Math.sin(cycle)*.05:0,outlet=stroke>3?Math.sin(cycle-Math.PI*3)*.05:0;
   [inlet,outlet].forEach((lift,j)=>{u.valves[j].stem.position.y=-lift;u.valves[j].spring.scale.y=1-lift/.22;});
   const crown=slider+.145,height=Math.max(.02,.905-crown);u.gas.scale.y=height;u.gas.position.y=crown+height/2;
   if(stroke<1){u.gasMaterial.color.copy(intakeColor);u.gasMaterial.opacity=.07;}
   else if(stroke<2){u.gasMaterial.color.copy(compressionColor);u.gasMaterial.opacity=.055+(stroke-1)*.045;}
   else if(stroke<3){u.gasMaterial.color.copy(powerColor);u.gasMaterial.opacity=.045+.14*Math.exp(-(stroke-2)*3);}
   else{u.gasMaterial.color.copy(exhaustColor);u.gasMaterial.opacity=.045;}
  }
 }
 let simTime=.58,paused=true,disposed=false,frame=0,last=0,previousDraw=0,yaw=0,contextLost=false;
 function draw(){if(disposed||contextLost)return;apply(simTime);rig.rotation.y=yaw;renderer.render(scene,camera);container.dataset.renderState='webgl';}
 function resize(){const rect=container.getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();draw();}
 function tick(now){if(disposed||paused||contextLost){frame=0;return;}frame=requestAnimationFrame(tick);if(now-previousDraw<32)return;simTime+=last?Math.min((now-last)/1000,.08):0;last=now;previousDraw=now;draw();}
 function setPaused(value){paused=!!value;last=0;if(paused){if(frame)cancelAnimationFrame(frame);frame=0;}else if(!frame&&!contextLost)frame=requestAnimationFrame(tick);}
 let pointer=null;
 canvas.style.touchAction='pan-y pinch-zoom';
 canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,yaw};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!pointer)return;yaw=pointer.yaw+(e.clientX-pointer.x)*.009;draw();});
 const release=()=>{pointer=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;if(frame)cancelAnimationFrame(frame);frame=0;container.dataset.renderState='poster';});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;draw();if(!paused)frame=requestAnimationFrame(tick);});
 const initial=container.getBoundingClientRect();renderer.setSize(Math.max(1,initial.width),Math.max(1,initial.height),false);camera.aspect=Math.max(1,initial.width)/Math.max(1,initial.height);camera.updateProjectionMatrix();apply(simTime);
 // Let supported drivers compile material programs without holding up page interaction.
 await renderer.compileAsync(scene,camera);
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const api={
  setPaused,
  renderAt(time){setPaused(true);simTime=time;draw();},
  setYaw(value){yaw=value;draw();},
  capture(){draw();return canvas.toDataURL('image/png');},
  inspect(){scene.updateMatrixWorld(true);return {renderer:'WebGLRenderer',camera:camera.type,paused,time:simTime,yaw,meshes:scene.getObjectsByProperty('isMesh',true).length,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,rodErrors:units.map(u=>{const upper=u.rod.localToWorld(new THREE.Vector3(0,.35,0)),lower=u.rod.localToWorld(new THREE.Vector3(0,-.35,0)),p=u.piston.localToWorld(new THREE.Vector3()),pin=u.crank.localToWorld(new THREE.Vector3(0,.22,0));return Math.max(upper.distanceTo(p),lower.distanceTo(pin));}),cylinders:units.length};},
  dispose(){disposed=true;setPaused(true);observer.disconnect();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});m.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();canvas.remove();}
 };
 container.engine3D=api;return api;
}
