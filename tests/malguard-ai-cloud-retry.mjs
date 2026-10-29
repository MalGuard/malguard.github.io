import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {chromium,launchOptions} from './browser-runtime.mjs';

const root=resolve('.');let online=false,statusRequests=0;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/malguard-ai/status'){
   statusRequests++;res.setHeader('Content-Type','application/json');
   if(!online){res.statusCode=503;return res.end('{"error":"synthetic_unavailable"}');}
   return res.end(JSON.stringify({enabled:true,tools:{},model:{state:'configured',defaultModel:'auto',models:[{id:'auto',label:'Auto',state:'configured'},{id:'cf_qwen3',label:'Qwen',state:'configured'}]}}));
  }
  if(url.pathname==='/api/game-scam-guard/auth/session'){
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({email:'player@example.com',username:'player',expiresAt:Date.now()+600000}));
  }
  const path=resolve('.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error('path');
  res.setHeader('Content-Type',({'.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.html':'text/html'}[extname(path)]||'application/octet-stream'));
  res.end(await readFile(path));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch(launchOptions('chromium'));
try{
 const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('malguard.ai.session.v1','synthetic-session'));
 await page.goto('http://127.0.0.1:'+server.address().port+'/ai/');
 await page.locator('#entry-gate').waitFor({state:'hidden'});
 await page.locator('#cloud-alert').waitFor({state:'visible'});
 assert.equal(await page.locator('#model option[value=auto]').isDisabled(),true);
 assert.equal(await page.locator('#model option[value=cf_qwen3]').count(),0);
 assert.equal(statusRequests,2);
 online=true;await page.locator('#retry-cloud').click();
 await page.locator('#model option[value=cf_qwen3]:not(:disabled)').waitFor({state:'attached'});
 assert.equal(await page.locator('#model option[value=auto]').isDisabled(),false);
 assert.equal(await page.locator('#cloud-alert').isVisible(),false);
 assert.deepEqual(errors,[]);
 await page.close();console.log('PASS cloud catalog outage, visible retry, and recovery without download');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
