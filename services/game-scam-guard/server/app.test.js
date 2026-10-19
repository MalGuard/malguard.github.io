import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { ScanError } from './network.js';

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

test('Google callback issues a completion ticket for a new verified Google identity',async()=>{
  const emailAuth={enabled:true,status:{},googleAccount:async profile=>{assert.equal(profile.email,'player@example.com');return {kind:'signup',signupToken:'signed-google-ticket'};},completeGoogleSignup:async()=>({sessionToken:'fixture'})};
  const googleAuth={enabled:true,status:{configured:true},start:()=> 'https://accounts.google.com/o/oauth2/v2/auth?fixture=1',complete:async()=>({email:'player@example.com',firstName:'Alex',lastName:'Morgan'})};
  const app=createApp({emailAuth,googleAuth,appOrigin:'https://app.example/game-scam-guard/'});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{const start=await fetch(`${base}/api/auth/google/start`,{redirect:'manual'});assert.equal(start.status,302);assert.equal(start.headers.get('location'),'https://accounts.google.com/o/oauth2/v2/auth?fixture=1');const callback=await fetch(`${base}/api/auth/google/callback?state=fixture&code=fixture-code`,{redirect:'manual'});assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'https://app.example/game-scam-guard/#guard-google-signup=signed-google-ticket');}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('live scan route streams verified stage events before its final report',async()=>{
  const app=createApp({scanSite:async(url,{onEvent})=>{onEvent({phase:'url_validation',message:'Validating the public website address'});onEvent({phase:'cloud_browser_done',message:'Isolated browser snapshot is ready'});return {url,status:'limited',preview:{status:'done'}};}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{const response=await fetch(`${base}/api/scan/live`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://example.com',mode:'advanced'})});assert.equal(response.status,200);const rows=(await response.text()).trim().split('\n').map(JSON.parse);assert.equal(rows[0].event.phase,'url_validation');assert.equal(rows[1].event.phase,'cloud_browser_done');assert.equal(rows[2].result.preview.status,'done');}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
