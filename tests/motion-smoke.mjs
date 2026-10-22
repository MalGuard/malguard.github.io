// Precision redesign QA. Supersedes the removed GTA Fusion-era homepage scene.
import {spawn} from 'node:child_process';
await import('./precision-home-qa.mjs');
await import('./fusion/home-opening-fracture.test.mjs');
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
for(const engine of engines){
 if(!['chromium','webkit'].includes(engine))throw Error('Unknown browser');
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['tests/precision-motion-journey.mjs'],{
   stdio:'inherit',env:{...process.env,TEST_BROWSER:engine}
  });
  child.on('error',reject);
  child.on('exit',code=>code===0?resolve():reject(Error('precision-motion-journey '+engine+' failed with '+code)));
 });
}
