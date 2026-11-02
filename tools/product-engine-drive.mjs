// One clock drives the crank, its geared app ring and the displayed rev level.
export const ENGINE_STARTUP=Object.freeze({fuelStart:.4,fuelEnd:1.08,sparkStart:1.18,sparkEnd:1.45,ignition:1.35,motion:1.52});
export const ENGINE_REST_ANGLE=Math.PI*2+.04;
export const ENGINE_REV_CYCLE=Object.freeze({rise:10,hold:3,fall:10,idle:4,idleSpeed:.12,maxTurnsPerSecond:3});

export function engineDriveAt(time){
 const {rise,hold,fall,idle,idleSpeed,maxTurnsPerSecond}=ENGINE_REV_CYCLE;
 const elapsed=Math.max(0,time-ENGINE_STARTUP.motion),duration=rise+hold+fall+idle;
 const cycles=Math.floor(elapsed/duration),phase=elapsed% duration;
 // The first start begins at rest; subsequent cycles rise from a rolling idle.
 const startingSpeed=cycles===0?0:idleSpeed;
 const risingTravel=(startingSpeed+1)*rise/2,fallingTravel=(1+idleSpeed)*fall/2;
 const firstTravel=rise/2+hold+fallingTravel+idleSpeed*idle;
 const repeatTravel=(1+idleSpeed)*(rise+fall)/2+hold+idleSpeed*idle;
 let speed,travel;
 if(phase<rise){
  speed=startingSpeed+(1-startingSpeed)*(1-Math.cos(Math.PI*phase/rise))/2;
  travel=startingSpeed*phase+(1-startingSpeed)*(phase-rise/Math.PI*Math.sin(Math.PI*phase/rise))/2;
 }else if(phase<rise+hold){speed=1;travel=risingTravel+phase-rise;}
 else if(phase<rise+hold+fall){
  const cooling=phase-rise-hold;
  speed=idleSpeed+(1-idleSpeed)*(1+Math.cos(Math.PI*cooling/fall))/2;
  travel=risingTravel+hold+idleSpeed*cooling+(1-idleSpeed)*(cooling+fall/Math.PI*Math.sin(Math.PI*cooling/fall))/2;
 }else{speed=idleSpeed;travel=risingTravel+hold+fallingTravel+idleSpeed*(phase-rise-hold-fall);}
 const completedTravel=cycles===0?0:firstTravel+(cycles-1)*repeatTravel;
 const turns=maxTurnsPerSecond*(completedTravel+travel);
 return {angle:ENGINE_REST_ANGLE+turns*Math.PI*2,speed,stage:time<ENGINE_STARTUP.fuelStart?'off':time<ENGINE_STARTUP.sparkStart?'fuel':time<ENGINE_STARTUP.ignition?'ignition':time<ENGINE_STARTUP.motion?'combustion':'running'};
}
