// One clock drives the crank, its geared app ring and the displayed rev level.
export const ENGINE_STARTUP=Object.freeze({fuelStart:.4,fuelEnd:1.08,sparkStart:1.18,sparkEnd:1.45,ignition:1.35,motion:1.52});
export const ENGINE_REST_ANGLE=Math.PI*2+.04;
export const ENGINE_REV_CYCLE=Object.freeze({rise:6,hold:1,fall:8,maxTurnsPerSecond:3});

export function engineDriveAt(time){
 const {rise,hold,fall,maxTurnsPerSecond}=ENGINE_REV_CYCLE;
 const elapsed=Math.max(0,time-ENGINE_STARTUP.motion),duration=rise+hold+fall;
 const cycles=Math.floor(elapsed/duration),phase=elapsed% duration;
 let speed,travel;
 if(phase<rise){
  speed=(1-Math.cos(Math.PI*phase/rise))/2;
  travel=(phase-rise/Math.PI*Math.sin(Math.PI*phase/rise))/2;
 }else if(phase<rise+hold){speed=1;travel=rise/2+phase-rise;}
 else{
  const cooling=phase-rise-hold;
  speed=(1+Math.cos(Math.PI*cooling/fall))/2;
  travel=rise/2+hold+(cooling+fall/Math.PI*Math.sin(Math.PI*cooling/fall))/2;
 }
 const turns=maxTurnsPerSecond*(cycles*(rise/2+hold+fall/2)+travel);
 return {angle:ENGINE_REST_ANGLE+turns*Math.PI*2,speed,stage:time<ENGINE_STARTUP.fuelStart?'off':time<ENGINE_STARTUP.sparkStart?'fuel':time<ENGINE_STARTUP.ignition?'ignition':time<ENGINE_STARTUP.motion?'combustion':'running'};
}
