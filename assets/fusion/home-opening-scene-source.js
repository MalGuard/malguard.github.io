/* Authored MalGuard evidence aperture, with geometry taken directly from the
   actual project SVG. No remote model, HDR, bloom pass, camera controls or RNG. */
import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import originalLogo from './assets/malguard-logo.svg';

window.createMalGuardHomeScene=async function(host,options={}){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,60),world=new THREE.Group();scene.add(world);
  const resources=new Set(),own=r=>(resources.add(r),r);
  let disposed=false,W=1,H=1,pixelRatio=Math.min(devicePixelRatio||1,options.lite?1.15:1.6),frames=0,renderMs=0,bad=0;
  const lost=e=>{e.preventDefault();options.onContextLost?.();dispose();};renderer.domElement.addEventListener('webglcontextlost',lost);
  function dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lost);resources.forEach(r=>r.dispose());resources.clear();scene.environment=null;renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
  try {
  const environment=own(new RoomEnvironment()),generator=own(new THREE.PMREMGenerator(renderer));
  const target=own(generator.fromScene(environment,.035));scene.environment=target.texture;environment.dispose();generator.dispose();
  resources.delete(environment);resources.delete(generator);
  scene.add(new THREE.HemisphereLight(0xcddded,0x070b16,.62));
  const key=new THREE.DirectionalLight(0xe3f1ff,2.7);key.position.set(-5,6,4);scene.add(key);
  const edge=new THREE.DirectionalLight(0x528cbe,2.2);edge.position.set(6,1,-3);scene.add(edge);
  const fill=new THREE.DirectionalLight(0xaccdde,.48);fill.position.set(-3,-3,5);scene.add(fill);
  const graphite=own(new THREE.MeshStandardMaterial({color:'#233442',metalness:.87,roughness:.38,envMapIntensity:.55}));
  const silver=own(new THREE.MeshStandardMaterial({color:'#6b8495',metalness:.92,roughness:.3,envMapIntensity:.6}));
  const blueLine=own(new THREE.MeshBasicMaterial({color:'#8db9d4',transparent:true,opacity:.47}));
  const darkLine=own(new THREE.MeshBasicMaterial({color:'#38586d',transparent:true,opacity:.65}));
  function poly(radius,Path=THREE.Shape,reverse=false){const p=new Path();for(let k=0;k<=6;k++){const i=reverse?6-k:k,a=i*Math.PI/3+Math.PI/6,x=Math.cos(a)*radius,y=Math.sin(a)*radius;k?p.lineTo(x,y):p.moveTo(x,y);}return p;}
  function ring(inner,outer,depth){const s=poly(outer);s.holes.push(poly(inner,THREE.Path,true));return own(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:options.lite?1:2,bevelSize:.028,bevelThickness:.025,curveSegments:1}));}
  function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
  const frames3d=[];
  for(let i=0;i<4;i++){
    const g=new THREE.Group();world.add(g);frames3d.push(g);
    mesh(ring(2.58-i*.12,2.76-i*.12,.12),i===0?silver:graphite,g);
    const pts=poly(2.59-i*.12).getPoints().map(p=>new THREE.Vector3(p.x,p.y,.17));
    g.add(new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(pts)),own(new THREE.LineBasicMaterial({color:i===0?'#90c9e6':'#497998',transparent:true,opacity:i===0?.65:.35}))));
  }
  const blades=[],bladeGeo=own(new THREE.BoxGeometry(.075,1.13,.07));
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,g=new THREE.Group();g.rotation.z=a;world.add(g);blades.push(g);
    mesh(bladeGeo,silver,g,0,2.45,.32);mesh(own(new THREE.BoxGeometry(.017,.78,.022)),blueLine,g,.06,2.45,.4);
    mesh(own(new THREE.BoxGeometry(.29,.038,.14)),graphite,g,0,2.76,.35);
  }
  // True vector extrusion: both real MG paths, all original counters, colors
  // and boundaries; the mark is not redrawn as a generic shield.
  const emblem=new THREE.Group();world.add(emblem);const emblemMaterials=[];
  const svg=new SVGLoader().parse(originalLogo);
  for(const path of svg.paths){
    const material=own(new THREE.MeshStandardMaterial({color:path.color,emissive:path.color,emissiveIntensity:.035,metalness:.53,roughness:.28,transparent:true,opacity:0,side:THREE.DoubleSide,envMapIntensity:.5}));emblemMaterials.push(material);
    for(const shape of SVGLoader.createShapes(path)){
      const geo=own(new THREE.ExtrudeGeometry(shape,{depth:12,bevelEnabled:true,bevelSize:1.1,bevelThickness:1.25,bevelSegments:options.lite?1:2,curveSegments:2}));
      geo.translate(-180,-178,0);geo.scale(.011,-.011,.011);geo.computeVertexNormals();mesh(geo,material,emblem);
    }
  }
  const pane=mesh(own(new THREE.PlaneGeometry(2.88,3.77)),own(new THREE.MeshPhysicalMaterial({color:'#44617b',metalness:.05,roughness:.25,clearcoat:1,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide})),world,0,0,-.06);
  const scanMaterial=own(new THREE.MeshBasicMaterial({color:'#b9e6fa',transparent:true,opacity:0,depthWrite:false}));
  const scan=mesh(own(new THREE.BoxGeometry(3.55,.012,.25)),scanMaterial,world,0,1.8,.32);
  const scanSkirt=mesh(own(new THREE.PlaneGeometry(3.55,.32)),own(new THREE.MeshBasicMaterial({color:'#2b7ca9',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})),world,0,1.6,.25);
  const rails=new THREE.Group();world.add(rails);
  const ticks=new THREE.InstancedMesh(own(new THREE.BoxGeometry(.034,.06,.025)),blueLine,36),tickMatrix=new THREE.Matrix4(),tickQuat=new THREE.Quaternion(),tickPos=new THREE.Vector3(),tickScale=new THREE.Vector3();
  for(let i=0;i<36;i++){const a=i*Math.PI/18;tickPos.set(Math.cos(a)*3.14,Math.sin(a)*3.14,-.55);tickQuat.setFromAxisAngle(new THREE.Vector3(0,0,1),a-Math.PI/2);tickScale.set(1,i%3===0?2:.75,1);tickMatrix.compose(tickPos,tickQuat,tickScale);ticks.setMatrixAt(i,tickMatrix);}rails.add(ticks);
  const links=new THREE.InstancedMesh(own(new THREE.BoxGeometry(.018,.018,.96)),darkLine,24),matrix=new THREE.Matrix4();
  for(let i=0;i<24;i++){const a=Math.floor(i/4)*Math.PI/3+Math.PI/6,r=2.69-i%4*.12;matrix.makeTranslation(Math.cos(a)*r,Math.sin(a)*r,-.55);links.setMatrixAt(i,matrix);}world.add(links);
  const lerp=(a,b,t)=>a+(b-a)*t;
  function resize(){if(disposed)return;W=Math.max(1,host.clientWidth);H=Math.max(1,host.clientHeight);renderer.setPixelRatio(pixelRatio);renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
  function draw(s){
    if(disposed)return;const before=performance.now(),t=s.elapsed/1000;
    if(W!==host.clientWidth||H!==host.clientHeight)resize();
    const open=s.open,wide=W>900,composition=wide?.67:.5,cy=wide?.48:.35;
    // Macro machining detail → layered boundary → front-facing brand reveal.
    // The object completes its motion before the original headline is released.
    camera.position.set(lerp(4.7,.18,open),lerp(1.1,.22,open),lerp(4.45,wide?12.6:15.7,open));
    camera.lookAt(0,0,0);camera.setViewOffset(W,H,-(composition-.5)*W,-(cy-.5)*H,W,H);
    world.rotation.set(lerp(.04,-.02,open),lerp(-.25,.04,open),lerp(-.18,0,open));
    for(let i=0;i<4;i++){const delayed=Math.min(1,Math.max(0,(open-i*.085)/.74));frames3d[i].position.z=-i*(.10+delayed*.48);frames3d[i].rotation.z=(1-delayed)*.045*(i-1.5);}
    blades.forEach((g,i)=>{const a=i*Math.PI/3;g.position.set(Math.sin(a)*open*.43,Math.cos(a)*open*.43,open*.16);g.rotation.z=a+(1-open)*.11;});
    emblem.position.z=lerp(-.45,.32,open);emblem.rotation.y=(1-open)*-.48;
    emblemMaterials.forEach(m=>m.opacity=s.logo);pane.material.opacity=.13*(.35+.65*open);
    scan.position.y=1.82-s.scan*3.64;scanSkirt.position.y=scan.position.y+.14;scanMaterial.opacity=s.beam*.65;scanSkirt.material.opacity=s.beam*.045;
    rails.rotation.z=lerp(-.14,0,open);links.material.opacity=.42+.18*open;
    key.intensity=2.1+.6*s.logo;edge.intensity=1.7+.5*open;
    renderer.render(scene,camera);renderMs=performance.now()-before;frames++;
    if(renderMs>24||s.frameDelta>55)bad++;else bad=Math.max(0,bad-1);
    if(bad>=5&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.2);bad=0;resize();}
  }
  function metrics(){return{frames,frameMs:renderMs,pixelRatio,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,authenticLogo:svg.paths.length===2,model:'MalGuard evidence aperture',camera:[camera.position.x,camera.position.y,camera.position.z]};}
  resize();await renderer.compileAsync(scene,camera);if(disposed)throw Error('Opening disposed');host.append(renderer.domElement);return{draw,resize,dispose,metrics,loseContext:()=>renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext()};
  }catch(e){dispose();throw e;}
};
