/* Original layered typography sculpture. Geometry shared by GPU and SVG fallback. */
(()=>{
 const colors={input:'#d0d3d9',reviewed:'#9ddcc0',flagged:'#e4a0a9'},entry=.28,exit=-.28;
 const alphabet='01{}[]<>/;:=abcdef0123456789';
 const model={strands:48,rows:42,layers:3,range:5.2,entry,exit};
 const project=([x,y,z])=>{const a=x*.9563+z*.29237,b=z*.9563-x*.29237,c=y*.985-b*.17255,d=y*.17255+b*.985,f=9/(9-d);return{x:300+a*90*f,y:250-c*90*f,z:d,scale:f};};
 function verdictFor(mode,lane){const type=mode==='mixed'?((Math.floor(lane/6)%2)?'risky':'clean'):mode;return globalThis.MalGuardCodeDemo?MalGuardCodeDemo.review(MalGuardCodeDemo.examples[type]).verdict:type==='risky'?'flagged':'reviewed';}
 function phaseFor(y){return y>entry?'incoming':y<exit?'outgoing':'inside';}
 function colorFor(y,verdict){return y<exit?colors[verdict]:colors.input;}
 function sample(lane,row,layer,time=2800,mode='mixed',strands=model.strands,rows=model.rows){
  const y=2.6-((row/model.rows*model.range+time*.00062)%model.range);
  const angle=lane/strands*Math.PI*2+y*.66+time*.000035+layer*.11;
  const radius=.95+1.22*Math.pow(Math.abs(y)/2.6,.85)-layer*.27;
  const world=[.38*Math.sin(y*.93)+radius*Math.cos(angle),y,.22*Math.cos(y*.9)+radius*.72*Math.sin(angle)],p=project(world),verdict=verdictFor(mode,lane),phase=phaseFor(y);
  const facing=.5+.5*Math.sin(angle+.29),front=.09+.89*Math.pow(facing,1.9),edge=Math.min(1,(2.6-Math.abs(y))/.32);
  return{kind:'glyph',lane,row,layer,world,point:p,depth:p.z,verdict,phase,color:colorFor(y,verdict),char:alphabet[Math.floor(lane*7+row*11+layer*5+Math.floor(time/190))%alphabet.length],font:(13.4+facing*2.0)*p.scale,opacity:Math.max(.02,front*edge*(1-layer*.30)),angle:0};
 }
 function commands(time=2800,mode='mixed',fallback=false){
  const result=[],strands=fallback?18:model.strands,rows=fallback?18:model.rows,layers=fallback?1:model.layers;
  for(let layer=0;layer<layers;layer++)for(let lane=0;lane<strands;lane++)for(let row=0;row<rows;row++){
   // Resample the same full-height path for the lighter vector fallback.
   const c=sample(lane,row*model.rows/rows,layer,time,mode,strands,rows);result.push(c);
  }
  return result.sort((a,b)=>a.depth-b.depth);
 }
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function svg(time=2800,mode='mixed'){
  const content=commands(time,mode,true).map(c=>`<text x="${c.point.x.toFixed(1)}" y="${c.point.y.toFixed(1)}" fill="${c.color}" opacity="${c.opacity.toFixed(2)}" font-size="${c.font.toFixed(1)}">${esc(c.char)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 520" fill="none"><g font-family="JetBrains,monospace">${content}</g></svg>`;
 }
 globalThis.MalGuardFlowGeometry=Object.freeze({project,commands,sample,phaseFor,colorFor,verdictFor,svg,colors,entry,exit,alphabet,model});
})();
