import test from 'node:test';
import assert from 'node:assert/strict';
import {engineDriveAt,ENGINE_STARTUP,ENGINE_REST_ANGLE,ENGINE_REV_CYCLE} from '../tools/product-engine-drive.mjs';

test('an earlier cold start preserves injection, spark and combustion before motion',()=>{
 for(const [time,stage] of [[0,'off'],[.7,'fuel'],[1.25,'ignition'],[1.43,'combustion'],[1.8,'running']])assert.equal(engineDriveAt(time).stage,stage);
 assert.equal(engineDriveAt(1.43).angle,ENGINE_REST_ANGLE);
 assert.ok(engineDriveAt(1.8).angle>ENGINE_REST_ANGLE);
 assert.ok(ENGINE_STARTUP.motion<2.12);
});

test('revs rise to the maximum, hold, then coast down more slowly and repeat smoothly',()=>{
 const start=ENGINE_STARTUP.motion,{rise,hold,fall}=ENGINE_REV_CYCLE,period=rise+hold+fall;
 assert.ok(fall>rise);
 for(let i=1;i<=60;i++)assert.ok(engineDriveAt(start+i*rise/60).speed>engineDriveAt(start+(i-1)*rise/60).speed);
 assert.equal(engineDriveAt(start+rise+hold/2).speed,1);
 for(let i=1;i<=80;i++)assert.ok(engineDriveAt(start+rise+hold+i*fall/80).speed<engineDriveAt(start+rise+hold+(i-1)*fall/80).speed);
 for(const boundary of [start,start+rise,start+rise+hold,start+period,start+period*2]){
  const before=engineDriveAt(boundary-1e-5),after=engineDriveAt(boundary+1e-5);
  assert.ok(Math.abs(after.angle-before.angle)<.001,'No angular jump at a phase boundary');
  assert.ok(Math.abs(after.speed-before.speed)<.001,'No sudden RPM change');
 }
 assert.ok(Math.abs(engineDriveAt(start+period+rise/2).speed-engineDriveAt(start+rise/2).speed)<1e-10);
});

test('the readout follows actual crank velocity throughout multiple rev cycles',()=>{
 for(let time=0;time<50;time+=.037){
  const state=engineDriveAt(time),step=.00001;
  const velocity=(engineDriveAt(time+step).angle-engineDriveAt(time-step).angle)/(2*step);
  assert.ok(state.speed>=0&&state.speed<=1);
  assert.ok(Math.abs(velocity-state.speed*Math.PI*2*ENGINE_REV_CYCLE.maxTurnsPerSecond)<.001);
 }
});
