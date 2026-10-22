/* One GPU point-sprite draw: thousands of characters, no per-frame JS glyph loop. */
(()=>{
 const vertex=`
 precision highp float;
 attribute vec4 aSeed;
 uniform float uTime,uMode,uDpr,uWidth;
 varying vec2 vCell;
 varying float vAlpha,vTint,vStretch;
 void main(){
  float lane=aSeed.x,row=aSeed.y,layer=aSeed.z;
  float y=2.6-mod(row/42.0*5.2+uTime*.00062,5.2);
  float angle=lane/48.0*6.283185307+y*.66+uTime*.000035+layer*.11;
  float radius=.95+1.22*pow(abs(y)/2.6,.85)-layer*.27;
  vec3 world=vec3(.38*sin(y*.93)+radius*cos(angle),y,.22*cos(y*.9)+radius*.72*sin(angle));
  float a=world.x*.9563+world.z*.29237,b=world.z*.9563-world.x*.29237;
  float c=world.y*.985-b*.17255,d=world.y*.17255+b*.985,f=9.0/(9.0-d);
  vec2 screen=vec2(300.0+a*90.0*f,250.0-c*90.0*f);
  gl_Position=vec4(screen.x/300.0-1.0,1.0-screen.y/260.0,-d/10.0,1.0);
  float facing=.5+.5*sin(angle+.29);
  vStretch=.32+.68*abs(sin(angle+.29));
  gl_PointSize=(13.4+facing*2.0)*f*uWidth/600.0*uDpr;
  float risky=mod(floor(lane/6.0),2.0);
  if(uMode>1.5)risky=1.0;else if(uMode>.5)risky=0.0;
  vTint=y<-.28?1.0+risky:0.0;
  float glyph=mod(lane*7.0+row*11.0+layer*5.0+floor(uTime/190.0),28.0);
  vCell=vec2(glyph,0.0);
  vAlpha=max(.02,(.09+.89*pow(facing,1.9))*min(1.0,(2.6-abs(y))/.32)*(1.0-layer*.30));
 }`;
 const fragment=`
 precision mediump float;
 uniform sampler2D uAtlas;
 uniform vec3 uInput,uGreen,uRed;
 varying vec2 vCell;
 varying float vAlpha,vTint,vStretch;
 void main(){
  vec2 q=vec2((gl_PointCoord.x-.5)/vStretch+.5,gl_PointCoord.y);
  if(q.x<0.0||q.x>1.0)discard;
  vec2 uv=vec2((vCell.x+q.x)/28.0,q.y);
  float ink=texture2D(uAtlas,uv).a;
  if(ink<.12)discard;
  vec3 color=vTint<.5?uInput:(vTint<1.5?uGreen:uRed);
  gl_FragColor=vec4(color,ink*vAlpha);
 }`;
 globalThis.createMalGuardFlowView=stage=>{
  const canvas=stage.querySelector('canvas'),geometry=globalThis.MalGuardFlowGeometry;
  let gl=null,lost=false,program,texture,locations={},size=0,paints=0,lastTime=2800,lastMode='mixed',fallbackMode=null,slow=0,budgetStatic=false;
  const weak=matchMedia('(prefers-reduced-motion: reduce)').matches||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2)||(navigator.deviceMemory&&navigator.deviceMemory<=2)||navigator.connection?.saveData;
  try{if(!weak)gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:false});}catch{}
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Visual shader unavailable');return s;}
  function buildAtlas(){
   const atlas=document.createElement('canvas');atlas.width=28*32;atlas.height=32;
   const ctx=atlas.getContext('2d');if(!ctx)throw Error('Glyph atlas unavailable');ctx.font='600 26px JetBrains,monospace';ctx.textAlign='center';ctx.fillStyle='#fff';
   for(let i=0;i<28;i++)ctx.fillText(geometry.alphabet[i%geometry.alphabet.length],i*32+16,26);
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
  }
  function fallback(mode){stage.dataset.renderState='fallback';stage.dataset.renderer='vector';if(mode!==fallbackMode){stage.querySelector('svg').outerHTML=geometry.svg(lastTime,mode);fallbackMode=mode;}}
  function draw(time=2800,mode='mixed'){
   lastTime=time;lastMode=mode;if(!gl||lost||!size){fallback(mode);return;}
   const started=performance.now();gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.uniform1f(locations.uTime,time);gl.uniform1f(locations.uMode,mode==='mixed'?0:mode==='clean'?1:2);gl.uniform1f(locations.uWidth,size);gl.uniform1f(locations.uDpr,canvas.width/size);
   gl.drawArrays(gl.POINTS,0,48*42*3);
   const cost=performance.now()-started;slow=cost>18?slow+1:0;if(slow>=3){budgetStatic=true;stage.dataset.motionFallback='budget';}
   stage.dataset.renderState='ready';stage.dataset.renderer='webgl';stage.dataset.renderFrames=String(++paints);stage.dataset.paintMs=cost.toFixed(2);stage.dataset.glyphCount=String(48*42*3);
  }
  try{if(!gl)throw Error('No WebGL');
   program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Visual link unavailable');gl.useProgram(program);
   for(const key of['uTime','uMode','uDpr','uWidth','uInput','uGreen','uRed','uAtlas'])locations[key]=gl.getUniformLocation(program,key);
   const seeds=new Float32Array(48*42*3*4);let n=0;
   for(let layer=0;layer<3;layer++)for(let lane=0;lane<48;lane++)for(let row=0;row<42;row++){seeds[n++]=lane;seeds[n++]=row;seeds[n++]=layer;seeds[n++]=0;}
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,seeds,gl.STATIC_DRAW);
   const attr=gl.getAttribLocation(program,'aSeed');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,4,gl.FLOAT,false,0,0);
   texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);buildAtlas();
   gl.uniform1i(locations.uAtlas,0);gl.uniform3fv(locations.uInput,rgb(geometry.colors.input));gl.uniform3fv(locations.uGreen,rgb(geometry.colors.reviewed));gl.uniform3fv(locations.uRed,rgb(geometry.colors.flagged));
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  }catch{gl=null;fallback('mixed');}
  const resize=()=>{size=stage.clientWidth;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*520/600*dpr);draw(lastTime,lastMode);};
  if(gl){if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize,{passive:true});resize();document.fonts?.ready.then(()=>{if(!lost){buildAtlas();draw(lastTime,lastMode);}});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;fallback(lastMode);});}
  return{draw,get animated(){return !!gl&&!lost&&!budgetStatic;}};
 };
})();
