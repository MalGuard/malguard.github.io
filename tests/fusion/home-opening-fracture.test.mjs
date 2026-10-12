import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fractureLogo,fragmentPose,rotateFragment} from '../../assets/fusion/home-opening-fracture-source.mjs';

const svg=readFileSync(new URL('../../assets/fusion/assets/malguard-logo.svg',import.meta.url),'utf8');
const model=fractureLogo(svg);
assert(model.pieces.length>=20&&model.pieces.length<60,'Fracture must retain a bounded set of actual vector pieces');
assert(Math.abs(model.sourceArea-model.fragmentArea)<1e-8,'The complete MG area survives fracture, with no replacement shapes or missing pieces');
assert.equal(new Set(model.pieces.map(p=>p.color)).size,2);
for(const [i,piece]of model.pieces.entries()){
  assert.deepEqual(fragmentPose(piece,i,0).position,piece.center,'Every piece starts at its original logo position');
  assert.deepEqual(rotateFragment([1,2,3],[0,0,0]),[1,2,3]);
  assert(piece.faces.every(face=>face.every(p=>p.every(Number.isFinite))));
  const early=fragmentPose(piece,i,.1),late=fragmentPose(piece,i,.5);
  assert(Math.hypot(late.position[0]-piece.center[0],late.position[1]-piece.center[1])>Math.hypot(early.position[0]-piece.center[0],early.position[1]-piece.center[1]),'Shards continue moving after separation');
}
// Exercise the production controller's actual state function at fixed times,
// independent of browser GPU speed; no second copy of the timing function.
const source=readFileSync(new URL('../../assets/fusion/home-opening.js',import.meta.url),'utf8');
const stateSource=source.slice(source.indexOf('  function state(){'),source.indexOf('  function releaseRenderer'));
const context=vm.createContext({innerWidth:1440,Math,elapsed:0,duration:7700,complete:false,frameDelta:16,spinAt:3400,releaseAt:5400,gatherAt:6150,formedAt:7450});
vm.runInContext('const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));const smooth=(a,b,n)=>{const v=clamp((n-a)/(b-a));return v*v*v*(v*(v*6-15)+10);};'+stateSource,context);
const at=t=>{context.elapsed=t;return vm.runInContext('state()',context);};
const before=at(5399),release=at(5400),after=at(5401),later=at(5800);
assert(release.quantumTurn>before.quantumTurn&&after.quantumTurn>release.quantumTurn&&later.quantumTurn>after.quantumTurn,'Rotation must continue through and after the explosion');
assert(Math.abs((release.quantumTurn-before.quantumTurn)-(after.quantumTurn-release.quantumTurn))<.0001,'Angular speed is continuous at release');
assert.equal(at(3400).quantumTurn,0);assert.equal(at(1900).portalX,.67);assert.equal(at(850).logo,1);
assert.equal(at(3399).particleProgress,0);assert.equal(at(6150).particleProgress,0);assert.equal(at(7700).particleProgress,1);
assert(at(5300).coreEnergy>at(4800).coreEnergy,'The central light charges before separation');
assert(later.explosionAge>after.explosionAge);assert.equal(later.fragments,1);
console.log(`PASS opening fracture: ${model.pieces.length} authentic solids; exact SVG area; continuous spin; original entrance and handoff clocks.`);
