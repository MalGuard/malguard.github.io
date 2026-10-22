import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { ScanError } from './network.js';
import express from 'express';

test('first-party Pages origins receive narrow CORS while other origins are rejected', async () => {
  const prior=process.env.GUARD_CLERK_PUBLISHABLE_KEY;
  process.env.GUARD_CLERK_PUBLISHABLE_KEY='pk_test_abcdefghijklmnopqrstuvwxyz';
  const app=createApp();const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const config=await fetch(`${base}/api/account-config`,{headers:{Origin:'https://malguard.site'}});
    assert.equal(config.status,200);assert.equal(config.headers.get('access-control-allow-origin'),'https://malguard.site');
    assert.deepEqual(await config.json(),{provider:'clerk',configured:true,publishableKey:'pk_test_abcdefghijklmnopqrstuvwxyz'});
    const options=await fetch(`${base}/api/scan`,{method:'OPTIONS',headers:{Origin:'https://malguard.site','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-credentials'),null);
    assert.equal((await fetch(`${base}/api/health`,{headers:{Origin:'https://attacker.example'}})).status,403);
  } finally { if(prior===undefined)delete process.env.GUARD_CLERK_PUBLISHABLE_KEY;else process.env.GUARD_CLERK_PUBLISHABLE_KEY=prior;server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
});

test('health reports URLhaus availability without exposing configuration values', async () => {
  const app=createApp({providerStatus:()=>({urlhaus:true})});const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try { const response=await fetch(`http://127.0.0.1:${server.address().port}/api/health`);assert.equal(response.status,200);assert.deepEqual((await response.json()).providers,{urlhaus:true}); }
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('disconnected clients retain scan slots until the actual work settles', async () => {
  const pending = [];
  let disconnected = 0;
  let workStarted;
  const allStarted = new Promise(resolve => { workStarted = resolve; });
  let allClosed;
  const closed = new Promise(resolve => { allClosed = resolve; });
  const app = createApp({scanSite: url => {
    if (url === 'probe') return Promise.resolve({status:'probe'});
    return new Promise(resolve => {
      pending.push(resolve);
      if (pending.length === 8) workStarted();
    });
  }});
  const server = app.listen(0,'127.0.0.1');
  server.on('request',(req,res) => {
    if (req.headers['x-test-hold']) res.once('close',() => {
      if (++disconnected === 8) allClosed();
    });
  });
  await once(server,'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/scan`;
  const controllers = Array.from({length:8},() => new AbortController());
  const post = (body,options={}) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...options.headers},body:JSON.stringify({url:body}),signal:options.signal});
  const requests = controllers.map(controller => post('hold',{signal:controller.signal,headers:{'x-test-hold':'1'}}).catch(() => null));
  try {
    await allStarted;
    assert.equal((await post('probe')).status,503);
    for (const controller of controllers) controller.abort();
    await closed;
    assert.equal((await post('probe')).status,503,'Closing the connection must not free unfinished scan work');
    for (const resolve of pending) resolve({status:'finished'});
    await Promise.all(requests);
    // A health response crosses the event loop after the settled handlers release their slots.
    await fetch(url.replace('/scan','/health'));
    assert.equal((await post('probe')).status,200,'Settled work must release its slots');
  } finally {
    controllers.forEach(controller => controller.abort());
    pending.forEach(resolve => resolve({status:'finished'}));
    await Promise.all(requests);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('failed scans release their slots and preserve the JSON error response', async () => {
  const app = createApp({scanSite:async () => {throw new ScanError('fixture failure',422);}});
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  try {
    for (let i=0;i<9;i++) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/scan`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,422);
      assert.deepEqual(await response.json(),{error:'fixture failure'});
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('account registration passes the complete profile and exposes account availability',async()=>{
  let received;const emailAuth={enabled:true,status:{},start:async input=>{received=input;return {verificationToken:'fixture-token'};},availability:async input=>({email:input.emailAddress==='used@example.com'?'taken':'available',username:input.username==='taken_name'?'taken':'available'}),verify:async()=>({sessionToken:'fixture'}),passwordSignIn:async()=>({sessionToken:'fixture'}),session:()=>({email:'player@example.com'})};const app=createApp({emailAuth});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{const profile={firstName:'Alex',lastName:'Morgan',birthDate:'2000-01-01',username:'player_guard',password:'StrongPass1'};const start=await fetch(`${base}/api/auth/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'player@example.com',profile})});assert.equal(start.status,200);assert.deepEqual(received,{emailAddress:'player@example.com',name:undefined,profile,ip:'127.0.0.1'});const availability=await fetch(`${base}/api/auth/availability`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'used@example.com',username:'taken_name'})});assert.deepEqual(await availability.json(),{email:'taken',username:'taken'});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('live scan route streams verified stage events before its final report',async()=>{
  const app=createApp({scanSite:async(url,{onEvent})=>{onEvent({phase:'url_validation',message:'Validating the public website address'});onEvent({phase:'cloud_browser_done',message:'Isolated browser snapshot is ready'});return {url,status:'limited',preview:{status:'done'}};}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{const response=await fetch(`${base}/api/scan/live`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://example.com',mode:'advanced'})});assert.equal(response.status,200);const rows=(await response.text()).trim().split('\n').map(JSON.parse);assert.equal(rows[0].event.phase,'url_validation');assert.equal(rows[1].event.phase,'cloud_browser_done');assert.equal(rows[2].result.preview.status,'done');}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('live validation failures retain their HTTP error status before any stream begins',async()=>{
  const app=createApp({scanSite:async(_url,{onEvent})=>{onEvent({phase:'url_validation',message:'Validating the public website address'});throw new ScanError('Private addresses are blocked.',400);}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{const response=await fetch(`${base}/api/scan/live`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1/'})});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'Private addresses are blocked.'});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});


test('email-only accounts do not advertise Google or expose OAuth routes',async()=>{
  const emailAuth={enabled:true,status:{hasApiKey:true,hasFromEmail:true}};
  const server=createApp({emailAuth}).listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.deepEqual(await (await fetch(`${base}/api/auth/status`)).json(),{provider:'first-party-email',configured:true,hasApiKey:true,hasFromEmail:true});
    for(const route of ['start','callback','complete-signup']){
      const response=await fetch(`${base}/api/auth/google/${route}`,route==='complete-signup'?{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}:{});
      assert.equal(response.status,404);assert.equal(response.headers.get('location'),null);
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('mounted APIs retain separate scan and continuation limits without bypassing either limit',async()=>{
  const api=createApp({scanSite:async()=>({status:'limited'}),startJob:async()=>({status:'fixture-job'}),preparePreview:async job=>job});
  const outer=express();outer.use('/api/game-scam-guard',(req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});
  const server=outer.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/game-scam-guard`;
  const post=path=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  try{
    for(let i=0;i<12;i++){const response=await post('/scan');assert.equal(response.status,200);await response.text();}
    const limited=await post('/scan');assert.equal(limited.status,429);await limited.text();
    for(let i=0;i<40;i++){const response=await post('/jobs/start');assert.equal(response.status,200,`Continuation ${i+1} must use its separate budget`);await response.text();}
    const jobLimited=await post('/jobs/start');assert.equal(jobLimited.status,429);await jobLimited.text();
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('self-test runs inert fixtures, returns bounded diagnostics and discloses no production credentials',async()=>{
 const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/self-test`);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const result=await response.json();assert.equal(result.scope,'synthetic-offline');assert.equal(result.summary.failed,0);assert.equal(result.summary.total,42);assert.ok(JSON.stringify(result).length<12000);assert.ok(!JSON.stringify(result).includes('self-test-fixture-only'));}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
