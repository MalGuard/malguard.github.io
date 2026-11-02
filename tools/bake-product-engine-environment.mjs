// Offline only: prefilter the original studio once, not on visitors' devices.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export function bakeEnvironment(){
 const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(1,1);
 const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const target=generator.fromScene(room,.04,.1,100,{size:256});
 const pixels=new Uint16Array(target.width*target.height*4);
 renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
 let peak=0;for(let i=0;i<pixels.length;i+=4)peak=Math.max(peak,THREE.DataUtils.fromHalfFloat(pixels[i]));
 const bytes=new Uint8Array(pixels.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 const result={width:target.width,height:target.height,peak,data:btoa(binary)};
 target.dispose();generator.dispose();room.dispose();renderer.dispose();return result;
}
