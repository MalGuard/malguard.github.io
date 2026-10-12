/* Cut the authored, straight-edged SVG into solids. Both renderers use these
   same faces and trajectories; nothing is substituted with confetti or boxes. */
import earcut from 'earcut';

const area=p=>p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v[0]*q[1]-q[0]*v[1];},0)/2;
function clip(poly,axis,bound,sign){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],inside=v=>sign*(v[axis]-bound)>=-1e-10;
    if(inside(a))out.push(a);
    if(inside(a)!==inside(b)){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}
export function fractureLogo(svg){
  const pieces=[];let sourceArea=0;
  for(const match of svg.matchAll(/<path\b[^>]*fill="([^"]+)"[^>]*\bd="([^"]+)"/g)){
    const [,color,d]=match;
    for(const contour of d.split(/Z/i)){
      const xy=contour.match(/-?\d+(?:\.\d+)?/g)?.map(Number);if(!xy||xy.length<6)continue;
      const outline=[];for(let i=0;i<xy.length;i+=2)outline.push([(xy[i]-180)*.011,(178-xy[i+1])*.011]);
      sourceArea+=Math.abs(area(outline));
      const indices=earcut(outline.flat()),cells=new Map(),size=.68;
      for(let i=0;i<indices.length;i+=3){
        const tri=indices.slice(i,i+3).map(j=>outline[j]);
        const xs=tri.map(p=>p[0]),ys=tri.map(p=>p[1]);
        for(let x=Math.floor(Math.min(...xs)/size);x<=Math.floor(Math.max(...xs)/size);x++)for(let y=Math.floor(Math.min(...ys)/size);y<=Math.floor(Math.max(...ys)/size);y++){
          let p=tri;for(const [axis,bound,sign]of [[0,x*size,1],[0,(x+1)*size,-1],[1,y*size,1],[1,(y+1)*size,-1]])p=clip(p,axis,bound,sign);
          if(p.length<3||Math.abs(area(p))<1e-9)continue;if(area(p)<0)p.reverse();
          const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);
        }
      }
      for(const polygons of cells.values()){
        let mass=0,cx=0,cy=0;const faces=[],edges=new Map(),pointKey=p=>p.map(v=>Math.round(v*1e7)).join(',');
        for(const p of polygons){
          for(let i=1;i<p.length-1;i++){
            const tri=[p[0],p[i],p[i+1]],a=Math.abs(area(tri));mass+=a;cx+=a*tri.reduce((n,v)=>n+v[0],0)/3;cy+=a*tri.reduce((n,v)=>n+v[1],0)/3;
            faces.push(tri.map(v=>[...v,.132]),tri.slice().reverse().map(v=>[...v,0]));
          }
          for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],key=pointKey(a)+'|'+pointKey(b),reverse=pointKey(b)+'|'+pointKey(a);if(edges.has(reverse))edges.delete(reverse);else edges.set(key,[a,b]);}
        }
        const center=[cx/mass,cy/mass,.066];
        for(const [a,b]of edges.values())faces.push([[...a,0],[...b,0],[...b,.132],[...a,.132]]);
        pieces.push({color,center,area:mass,faces:faces.map(face=>face.map(p=>p.map((v,i)=>v-center[i])))});
      }
    }
  }
  return{pieces,sourceArea,fragmentArea:pieces.reduce((n,p)=>n+p.area,0)};
}
export function fragmentPose(piece,index,age){
  const [x,y,z]=piece.center,r=Math.hypot(x,y)||1,a=Math.atan2(y,x)+(index%3-1)*.16;
  const travel=age*(2.8+(index%5)*.32);
  return{position:[x+Math.cos(a)*travel,y+Math.sin(a)*travel-age*age*.22,z+age*((index%7-3)*.42)],rotation:[age*(index%3-1)*1.8,age*(index%5-2)*1.1,age*(index%2?1:-1)*1.5],radius:r};
}
export function rotateFragment(p,r){
  const [x,y,z]=p,[rx,ry,rz]=r,cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx),cz=Math.cos(rz),sz=Math.sin(rz);
  const y1=y*cx-z*sx,z1=y*sx+z*cx,x2=x*cy+z1*sy,z2=-x*sy+z1*cy;
  return[x2*cz-y1*sz,x2*sz+y1*cz,z2];
}
