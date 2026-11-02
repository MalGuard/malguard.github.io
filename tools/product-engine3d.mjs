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
 camera.position.set(3.1,2.3,6.3);camera.lookAt(0,.33,0);
 const rig=new THREE.Group();scene.add(rig);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=1.05;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xcce2ff,0x292533,.48));
 const key=new THREE.DirectionalLight(0xfff3e5,3.2);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(innerWidth<600?512:1024,innerWidth<600?512:1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.camera.near=.5;key.shadow.camera.far=15;key.shadow.normalBias=.015;key.shadow.bias=-.0002;scene.add(key);
 const rim=new THREE.DirectionalLight(0x7bbcff,2.1);rim.position.set(3,2,-3);scene.add(rim);
 const warm=new THREE.DirectionalLight(0xffc18a,.9);warm.position.set(-3,1,-2);scene.add(warm);
 const steel=new THREE.MeshStandardMaterial({color:0xb6c0cb,metalness:1,roughness:.23});
 const satin=new THREE.MeshStandardMaterial({color:0x8e9cab,metalness:.9,roughness:.3});
 const dark=new THREE.MeshStandardMaterial({color:0x172431,metalness:.82,roughness:.28});
 const black=new THREE.MeshStandardMaterial({color:0x11161d,metalness:.7,roughness:.33});
 const bronze=new THREE.MeshStandardMaterial({color:0x9b7048,metalness:.92,roughness:.25});
 const ringMat=new THREE.MeshStandardMaterial({color:0x272d35,metalness:.93,roughness:.25});
 const liner=new THREE.MeshStandardMaterial({color:0x46515b,metalness:.9,roughness:.3,side:THREE.DoubleSide});
 // Fine circumferential machining is generated once and shared by all pistons.
 const machiningCanvas=document.createElement('canvas');machiningCanvas.width=128;machiningCanvas.height=256;
 const mc=machiningCanvas.getContext('2d'),grain=mc.createImageData(128,256);
 let seed=1729;for(let y=0;y<256;y++)for(let x=0;x<128;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=190+Math.sin(y*2.41)*12+(seed/4294967296-.5)*8,i=(y*128+x)*4;grain.data[i]=grain.data[i+1]=grain.data[i+2]=value;grain.data[i+3]=255;}mc.putImageData(grain,0,0);
 const machining=new THREE.CanvasTexture(machiningCanvas);machining.wrapS=THREE.RepeatWrapping;
 const aluminum=new THREE.MeshPhysicalMaterial({color:0xcbd0d2,metalness:1,roughness:.34,roughnessMap:machining,bumpMap:machining,bumpScale:.0013,anisotropy:.5,anisotropyRotation:Math.PI/2});
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
 const centers=[-.99,-.33,.33,.99];
 // Open the front of the cutaway head so the injector, valves and flame are visible.
 const deckShape=new THREE.Shape();deckShape.moveTo(-1.5,-.36);deckShape.lineTo(1.5,-.36);deckShape.lineTo(1.5,.36);
 for(const x of [...centers].reverse()){deckShape.lineTo(x+.267,.36);deckShape.lineTo(x+.267,0);deckShape.absarc(x,0,.267,0,-Math.PI,true);deckShape.lineTo(x-.267,.36);}
 deckShape.lineTo(-1.5,.36);deckShape.closePath();
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
 const pistonProfile=[new THREE.Vector2(.215,-.25),new THREE.Vector2(.237,-.235)];
 for(let y=-.22;y<.063;y+=.008)pistonProfile.push(new THREE.Vector2(.246,y));
 for(const y of [.075,.115,.155])pistonProfile.push(new THREE.Vector2(.246,y-.009),new THREE.Vector2(.235,y-.006),new THREE.Vector2(.235,y+.006),new THREE.Vector2(.246,y+.009));
 pistonProfile.push(new THREE.Vector2(.246,.18),new THREE.Vector2(.238,.199),new THREE.Vector2(.221,.205),new THREE.Vector2(.18,.205),new THREE.Vector2(.15,.195),new THREE.Vector2(.09,.19),new THREE.Vector2(0,.19),new THREE.Vector2(0,.15),new THREE.Vector2(.207,.15),new THREE.Vector2(.207,.063));
 for(let y=.055;y>-.23;y-=.008)pistonProfile.push(new THREE.Vector2(.207,y));
 pistonProfile.push(new THREE.Vector2(.215,-.25));
 const pistonGeometry=new THREE.LatheGeometry(pistonProfile,64);
 // Genuine openings through both skirt walls for the wrist pin and its bushes.
 const positions=pistonGeometry.attributes.position,index=pistonGeometry.index.array,cutIndices=[];
 for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]];const x=ids.reduce((v,j)=>v+positions.getX(j),0)/3,y=ids.reduce((v,j)=>v+positions.getY(j),0)/3,z=ids.reduce((v,j)=>v+positions.getZ(j),0)/3;if(!(Math.abs(x)>.18&&y*y+z*z<.054*.054))cutIndices.push(...ids);}
 pistonGeometry.setIndex(cutIndices);pistonGeometry.computeVertexNormals();
 // A forged, beveled web with a real lightening opening joins the two bearing eyes.
 const rodShape=new THREE.Shape();rodShape.moveTo(-.065,-.28);rodShape.lineTo(-.035,-.15);rodShape.lineTo(-.028,.19);rodShape.lineTo(-.045,.29);rodShape.lineTo(.045,.29);rodShape.lineTo(.028,.19);rodShape.lineTo(.035,-.15);rodShape.lineTo(.065,-.28);rodShape.closePath();
 const relief=new THREE.Path();relief.moveTo(-.011,-.15);relief.lineTo(.011,-.15);relief.lineTo(.011,.17);relief.absarc(0,.17,.011,0,Math.PI,false);relief.lineTo(-.011,-.15);rodShape.holes.push(relief);
 const rodGeometry=new THREE.ExtrudeGeometry(rodShape,{depth:.055,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:12});rodGeometry.translate(0,0,-.0275);
 const helix=new THREE.CatmullRomCurve3(Array.from({length:101},(_,i)=>{const a=i/100*Math.PI*10;return new THREE.Vector3(Math.cos(a)*.038,i/100*.22,Math.sin(a)*.038);}));
 const springGeometry=new THREE.TubeGeometry(helix,100,.0055,5,false);
 // Compact, pre-rendered flame/particle textures; no video or per-frame image generation.
 const flameCanvas=document.createElement('canvas');flameCanvas.width=128;flameCanvas.height=128;
 const fc=flameCanvas.getContext('2d');
 // A short turbulent combustion front, rather than a candle-shaped flame.
 const front=fc.createRadialGradient(64,58,3,64,64,61);
 front.addColorStop(0,'rgba(255,255,235,1)');front.addColorStop(.22,'rgba(255,240,171,.95)');front.addColorStop(.48,'rgba(255,162,40,.78)');front.addColorStop(.76,'rgba(255,75,12,.37)');front.addColorStop(1,'rgba(199,32,3,0)');
 fc.fillStyle=front;fc.beginPath();
 for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,r=53+Math.sin(a*7)*4+Math.cos(a*11)*3;const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;if(i===0)fc.moveTo(x,y);else fc.lineTo(x,y);}fc.closePath();fc.fill();
 const fireTexture=new THREE.CanvasTexture(flameCanvas);fireTexture.colorSpace=THREE.SRGBColorSpace;
 const dotCanvas=document.createElement('canvas');dotCanvas.width=64;dotCanvas.height=64;const dc=dotCanvas.getContext('2d'),dg=dc.createRadialGradient(32,32,0,32,32,31);dg.addColorStop(0,'rgba(255,255,255,1)');dg.addColorStop(.2,'rgba(255,255,255,.85)');dg.addColorStop(1,'rgba(255,255,255,0)');dc.fillStyle=dg;dc.fillRect(0,0,64,64);
 const dotTexture=new THREE.CanvasTexture(dotCanvas);
 const combustionLight=new THREE.PointLight(0xffa348,0,1.4,2);rig.add(combustionLight);
 const plugCeramic=new THREE.MeshStandardMaterial({color:0xe3e5dc,metalness:.08,roughness:.2});
 const sparkMaterial=new THREE.MeshBasicMaterial({color:0xe3f4ff,toneMapped:false});
 function particles(count,color,size,parent){const positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color,size,map:dotTexture,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});const points=new THREE.Points(geometry,material);points.frustumCulled=false;parent.add(points);return points;}
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
  const piston=new THREE.Group();group.add(piston);mesh(pistonGeometry,aluminum,piston);
  for(const y of [.075,.115,.155])ring(.241,.005,ringMat,piston).position.y=y;
  axle(.039,.50,steel,piston).position.y=0;
  for(const x of [-.233,.233]){const bush=mesh(new THREE.TorusGeometry(.046,.008,10,36),bronze,piston);bush.rotation.y=Math.PI/2;bush.position.x=x;}
  const rod=new THREE.Group();group.add(rod);
  mesh(rodGeometry,satin,rod);
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
  // Spark plug and inlet/exhaust ports are physical parts of the cutaway head.
  mesh(cylinder(.023,.13,24),plugCeramic,group).position.set(0,1.055,.12);
  for(const y of [1.02,1.055,1.09])ring(.024,.004,plugCeramic,group).position.set(0,y,.12);
  mesh(cylinder(.032,.035,6),steel,group).position.set(0,.972,.12);
  mesh(cylinder(.006,.065,12),steel,group).position.set(0,.922,.12);
  const electrodeCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.024,.952,.12),new THREE.Vector3(.025,.9,.12),new THREE.Vector3(.01,.89,.12)]);
  mesh(new THREE.TubeGeometry(electrodeCurve,14,.004,5,false),satin,group);
  const inletCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.36,1.1,.05),new THREE.Vector3(-.2,1.08,.05),new THREE.Vector3(-.10,.95,.03)]);
  const outletCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.10,.95,-.04),new THREE.Vector3(.22,1.07,-.08),new THREE.Vector3(.36,1.1,-.08)]);
  const portMaterial=new THREE.MeshStandardMaterial({color:0x8aa9be,metalness:.7,roughness:.3,transparent:true,opacity:.48,depthWrite:false});
  mesh(new THREE.TubeGeometry(inletCurve,18,.019,8,false),portMaterial,group);
  mesh(new THREE.TubeGeometry(outletCurve,18,.019,8,false),satin,group);
  const nozzle=mesh(new THREE.CylinderGeometry(.019,.012,.16,18),bronze,group);nozzle.position.set(.18,1.01,.14);nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-.08,-.14,0).normalize());
  const flow=particles(16,0x72d5ff,.028,group),fuel=particles(96,0xe9e5dc,.045,group);
  const flame=new THREE.Sprite(new THREE.SpriteMaterial({map:fireTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));group.add(flame);
  const spark=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTexture,color:0xc7ebff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));spark.position.set(.005,.889,.12);spark.scale.set(.12,.12,1);group.add(spark);
  const sparkCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.902,.12),new THREE.Vector3(.012,.896,.122),new THREE.Vector3(.004,.888,.12),new THREE.Vector3(.014,.888,.12)]);
  const arc=mesh(new THREE.TubeGeometry(sparkCurve,10,.0025,4,false),sparkMaterial,group);arc.castShadow=false;
  units.push({x,group,crank,piston,rod,gas,gasMaterial,valves,flow,fuel,flame,spark,arc,phase:phases[i],primeAngle:i===0?0:(Math.PI*4-phases[i]<Math.PI*2?Math.PI*8-phases[i]:Math.PI*4-phases[i]),index:i,slider:0,angle:0,stage:'off',valveLift:[0,0]});
 });
 // Soft studio grounding is a tiny locally generated texture, not a post-processing pass.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');const g=ctx.createRadialGradient(64,64,10,64,64,63);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const shadow=mesh(new THREE.PlaneGeometry(4.1,2.0),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.945;shadow.castShadow=false;
 const yAxis=new THREE.Vector3(0,1,0),top=new THREE.Vector3(),bottom=new THREE.Vector3(),direction=new THREE.Vector3();
 const iSeed=x=>x*13.7;
 const intakeColor=new THREE.Color(0x63bdf0),powerColor=new THREE.Color(0xffac55),compressionColor=new THREE.Color(0xb8cde0),exhaustColor=new THREE.Color(0x8e9fb5);
 const drivenRotor=container.closest('.brand-orbit')?.querySelector('.orbit-rotor');
 // The presentation begins with direct injection into a stationary, sealed chamber.
 // Combustion precedes crank motion; acceleration integrates continuously into running speed.
 const tau=Math.PI*2,restAngle=tau+.04,motionStart=2.12,ignitionTime=1.94,rampDuration=.95;
 function driveAt(time){
  const elapsed=Math.max(0,time-motionStart);
  const travel=elapsed<rampDuration?elapsed*elapsed/(2*rampDuration):elapsed-rampDuration/2;
  return {angle:restAngle+travel*tau/3.4,stage:time<.85?'off':time<1.78?'fuel':time<ignitionTime?'ignition':time<motionStart?'combustion':'running'};
 }
 function apply(time){
  const drive=driveAt(time),angle=drive.angle;
  drivenRotor?.style.setProperty('--engine-drive-angle',`${(angle-restAngle)*180/Math.PI/8}deg`);
  fly.rotation.x=angle;let strongestBurn=0;
  for(const u of units){
   const a=angle+u.phase,pinY=-.35+.22*Math.cos(a),pinZ=.22*Math.sin(a),slider=pinY+Math.sqrt(.7*.7-pinZ*pinZ);
   u.slider=slider;u.angle=a;u.crank.rotation.x=a;u.piston.position.y=slider;
   top.set(0,slider,0);bottom.set(0,pinY,pinZ);u.rod.position.copy(top).add(bottom).multiplyScalar(.5);direction.copy(top).sub(bottom).normalize();u.rod.quaternion.setFromUnitVectors(yAxis,direction);
   const cycle=((a%(Math.PI*4))+Math.PI*4)%(Math.PI*4),stroke=cycle/Math.PI;
   const running=time>=motionStart,primed=running&&angle>=u.primeAngle,charged=running&&angle>=u.primeAngle+Math.PI,canFire=running&&angle>=u.primeAngle+tau;
   const inlet=primed&&stroke<1?Math.sin(cycle)*.075:0,outlet=charged&&stroke>3?Math.sin(cycle-Math.PI*3)*.075:0;
   // Both poppet valves open down into the chamber; the fixed spring seat stays still.
   u.valveLift=[inlet,outlet];
   [inlet,outlet].forEach((lift,j)=>{u.valves[j].stem.position.y=-lift;u.valves[j].spring.scale.y=(.22-lift)/.22;});
   const crown=slider+.205,height=Math.max(.02,.905-crown);u.gas.scale.y=height;u.gas.position.y=crown+height/2;
   const firstStart=u.index===0&&angle<Math.PI*3;
   const startupFuel=firstStart&&time>=.85&&time<1.64;
   const intake=primed&&stroke<1,exhaust=charged&&stroke>=3;
   // Direct injection uses a short cone of fine droplets, not streams from every cylinder.
   const injection=startupFuel||(intake&&stroke>.12&&stroke<.65);
   u.stage=!running?(u.index===0?drive.stage:'off'):stroke<1?'intake':stroke<2?'compression':stroke<3?'combustion':'exhaust';
   u.flow.visible=intake||exhaust;u.fuel.visible=injection;u.fuel.material.opacity=.8;
   if(u.flow.visible){
    u.flow.material.color.set(exhaust?0xa3acb9:0x67d1ff);u.flow.material.opacity=exhaust?.2:.5;
    const positions=u.flow.geometry.attributes.position.array;
    for(let j=0;j<16;j++){
     const p=(time*1.45+j/16)%1,w=Math.sin(j*2.1+time*3)*.008;
     if(exhaust){positions[j*3]=.1+.30*p;positions[j*3+1]=.94+.16*p;positions[j*3+2]=-.04-.04*p+w;}
     else if(p<.55){const q=p/.55;positions[j*3]=-.36+.26*q;positions[j*3+1]=1.1-.15*q+Math.sin(q*Math.PI)*.02;positions[j*3+2]=.05-.02*q+w;}
     else{const q=(p-.55)/.45;positions[j*3]=-.1*(1-q)+w;positions[j*3+1]=.95-(.95-crown-.025)*q;positions[j*3+2]=.03+Math.sin(q*Math.PI)*.06;}
    }u.flow.geometry.attributes.position.needsUpdate=true;
   }
   if(injection){
    const positions=u.fuel.geometry.attributes.position.array,maxTravel=Math.min(.34,(.94-crown-.025)/.9);
    for(let j=0;j<96;j++){
     const p=(time*3.4+j*.61803398875)%1,azimuth=j*2.399963,spread=Math.sqrt((j*.754877666)%1)*.047*p,travel=p*maxTravel;
     positions[j*3]=.14-.44*travel+Math.cos(azimuth)*spread;
     positions[j*3+1]=.94-.9*travel;
     positions[j*3+2]=.14+Math.sin(azimuth)*spread;
    }u.fuel.geometry.attributes.position.needsUpdate=true;
   }
   const ignition=firstStart?(time>=1.78&&time<2.01):(charged&&angle>=u.primeAngle+Math.PI*1.94&&stroke>1.94&&stroke<2.035);
   u.spark.visible=ignition;u.arc.visible=ignition;u.spark.material.opacity=.8+.15*Math.sin(time*89+iSeed(u.x));
   const progress=stroke-2,age=time-ignitionTime;
   const burn=firstStart?(age>=0&&age<1.15?Math.min(1,age/.055)*Math.exp(-age*2.25):0):(canFire&&progress>=0&&progress<.65?Math.min(1,progress/.035)*Math.exp(-progress*5):0);
   u.flame.visible=burn>.016;
   if(u.flame.visible){
    const spread=firstStart?Math.min(1,Math.max(0,age)/.14):Math.min(1,progress/.09);
    const flameHeight=height*(.24+.76*spread),flicker=.97+.03*Math.sin(time*57+u.x*7);
    u.flame.material.opacity=Math.min(.98,burn*1.2);u.flame.scale.set((.08+.40*spread)*flicker,flameHeight,1);u.flame.position.set(.005*(1-spread),.89-flameHeight*.5,.12);
   }
   u.gasMaterial.color.copy(burn>.016?powerColor:intake?intakeColor:exhaust?exhaustColor:compressionColor);
   u.gasMaterial.opacity=burn>.016?.04+burn*.18:intake?.045:!running&&u.index===0&&time>=.85?.025:charged&&stroke<2?.035:.004;
   if(burn>strongestBurn){strongestBurn=burn;combustionLight.position.set(u.x,crown+height*.65,.12);}
  }
  combustionLight.intensity=strongestBurn*1.1;
  container.dataset.startupPhase=drive.stage;
  const phase=units[0].stage;if(container.dataset.cyclePhase!==phase){container.dataset.cyclePhase=phase;container.closest('.brand-orbit').dataset.cyclePhase=phase;}
 }
 let simTime=0,paused=true,disposed=false,frame=0,last=0,previousDraw=0,yaw=0,contextLost=false;
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
 units.forEach(u=>{u.flame.visible=true;u.spark.visible=true;u.arc.visible=true;u.flow.visible=true;u.fuel.visible=true;});combustionLight.intensity=.01;
 await renderer.compileAsync(scene,camera);apply(simTime);
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const api={
  setPaused,
  renderAt(time){setPaused(true);simTime=time;draw();},
  setYaw(value){yaw=value;draw();},
  capture(){draw();return canvas.toDataURL('image/png');},
  inspect(){scene.updateMatrixWorld(true);return {renderer:'WebGLRenderer',camera:camera.type,paused,time:simTime,yaw,restAngle,startupPhase:driveAt(simTime).stage,crankAngle:driveAt(simTime).angle,cyclePhase:units[0].stage,valves:units.map(u=>({inlet:u.valveLift[0],outlet:u.valveLift[1],stemY:u.valves.map(v=>v.stem.position.y),springScale:u.valves.map(v=>v.spring.scale.y)})),effects:units.map(u=>({air:u.flow.visible&&u.stage==='intake',fuel:u.fuel.visible,spark:u.spark.visible,fire:u.flame.visible,exhaust:u.flow.visible&&u.stage==='exhaust'})),meshes:scene.getObjectsByProperty('isMesh',true).length,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,rodErrors:units.map(u=>{const upper=u.rod.localToWorld(new THREE.Vector3(0,.35,0)),lower=u.rod.localToWorld(new THREE.Vector3(0,-.35,0)),p=u.piston.localToWorld(new THREE.Vector3()),pin=u.crank.localToWorld(new THREE.Vector3(0,.22,0));return Math.max(upper.distanceTo(p),lower.distanceTo(pin));}),cylinders:units.length};},
  dispose(){disposed=true;setPaused(true);observer.disconnect();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});materials.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});m.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();canvas.remove();}
 };
 container.engine3D=api;return api;
}
