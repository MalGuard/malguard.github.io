import test from 'node:test';
import {request} from 'node:http';
import assert from 'node:assert/strict';
import {startLocalStaging} from '../tools/engineering-staging/server.mjs';
test('loopback center requires exact Host/Origin and an ephemeral session for API reads/writes',async()=>{
 let executions=0;const service=await startLocalStaging({port:0,lab:{runChecks:async()=>{executions++;return {passed:true,checks:[]};},close:async()=>{}},analyzer:{status:()=>({enabled:false}),analyze:async()=>({state:'MANUAL_REVIEW'})}});
 try{
  const root=await fetch(service.url);assert.equal(root.status,200);assert.match(root.headers.get('content-security-policy'),/frame-ancestors 'none'/);const html=await root.text();const token=html.match(/name="staging-session" content="([a-f0-9]+)"/)[1];
  assert.equal((await fetch(service.url+'/api/events')).status,401);
  const headers={'X-Staging-Session':token,'Content-Type':'application/json',Origin:service.url};
  assert.equal((await fetch(service.url+'/api/events',{headers})).status,200);
  assert.equal((await fetch(service.url+'/api/lab',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'})).status,403);
  assert.equal((await fetch(service.url+'/api/lab',{method:'POST',headers,body:'{}'})).status,200);assert.equal(executions,1);
  assert.equal(await new Promise((resolve,reject)=>{const req=request(service.url,{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
  assert.equal((await fetch(service.url+'/api/lab',{method:'POST',headers,body:JSON.stringify({message:'x'.repeat(18000)})})).status,413);
 }finally{await service.close();}
});
