// The approved film's own scene, composition and failure checks, on local HTML.
import {spawn} from 'node:child_process';
const engines=process.env.TEST_BROWSER?[process.env.TEST_BROWSER]:['chromium','webkit'];
for(const engine of engines){
 if(!['chromium','webkit'].includes(engine))throw Error('Unknown browser');
 for(const [script,args] of [['home-opening-qa.cjs',[]],['gta-fusion-regression.cjs',[]],['gta-journey-qa.cjs',['--only=desktop']],['gta-journey-qa.cjs',['--only=mobile']],['gta-journey-qa.cjs',['--only=ipad']],['gta-journey-qa.cjs',['--negative']]]){
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tests/fusion/'+script,engine,...args],{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(script+' '+engine+' failed with '+code)));});
 }
}
