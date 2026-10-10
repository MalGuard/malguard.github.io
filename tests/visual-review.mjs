import {chromium,launchOptions} from './browser-runtime.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://127.0.0.1:8443';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch(launchOptions('chromium')),metrics=[];
try{
 for(const width of [390,1440]){
  const c=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:width<600?844:960},reducedMotion:'no-preference'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const p=await c.newPage();
  for(const path of ['products','tools','gta-guard','trust','malware-ai','game-scam-guard','about']){
   await p.goto(base+'/'+path+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1300);
   await p.screenshot({path:`test-results/visual-${width}-${path}.png`});
   const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,header:document.getElementById('navbar')?.getBoundingClientRect().toJSON(),fonts:document.fonts.status,transfer:performance.getEntriesByType('resource').reduce((a,b)=>a+b.transferSize,0)}));
   assert.equal(state.overflow,false);if(state.header)assert(state.header.left>=0&&state.header.right<=width+1);
   metrics.push({width,path,...state});
  }
  await c.close();
 }
 await writeFile('test-results/visual-metrics.json',JSON.stringify(metrics,null,2));
}finally{await browser.close();}
