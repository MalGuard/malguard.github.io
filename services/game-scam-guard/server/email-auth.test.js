import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailAuth} from './email-auth.js';

test('email verification codes do not depend on the non-cryptographic Math.random generator',async()=>{
  const original=Math.random;let body;
  Math.random=()=>{throw new Error('non_crypto_rng_called');};
  try{
    const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:{enabled:false,status:{}},fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
    const started=await auth.start({emailAddress:'player@example.com'});
    const code=body.htmlContent.match(/>(\d{6})</)?.[1];
    assert.match(code,/^[1-9]\d{5}$/);
    assert.ok((await auth.verify({...started,code})).sessionToken);
  }finally{Math.random=original;}
});

test('first-party email auth sends a code through Brevo and issues an expiring opaque session',async()=>{
  let body;const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',now:()=>1000,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'Player@Example.com',name:'player_guard',ip:'198.51.100.7'});
  assert.equal(body.sender.name,'MalGuard');assert.equal(body.subject,'Your MalGuard verification code');assert.match(body.htmlContent,/Your MalGuard verification code/);
  assert.equal(auth.enabled,true);assert.equal(auth.status.hasApiKey,true);assert.equal(auth.status.hasFromEmail,true);assert.match(started.verificationToken,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);assert.equal(body.to[0].email,'player@example.com');
  const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});const session=auth.session(verified);
  const {sessionToken,...profile}=session;
  assert.deepEqual(profile,{email:'player@example.com',username:'player_guard',firstName:null,lastName:null,birthDate:null,expiresAt:1000+30*24*60*60*1000});
  assert.match(sessionToken,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(auth.session({sessionToken}).expiresAt,session.expiresAt);
});

test('first-party email auth rejects bad codes and does not expose them in its responses',async()=>{
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async()=>({ok:true})});const started=await auth.start({emailAddress:'player@example.com',ip:'198.51.100.7'});
  await assert.rejects(async()=>auth.verify({verificationToken:started.verificationToken,code:'000000'}),{status:400});assert.deepEqual(Object.keys(started),['verificationToken']);
});

test('an active session renews for another 30 days and an expired token stays invalid',async()=>{
  let time=1000,body;
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',now:()=>time,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'player@example.com'}),code=body.htmlContent.match(/>(\d{6})</)[1];
  const first=await auth.verify({...started,code});
  time+=20*24*60*60*1000;
  const renewed=auth.session(first);
  assert.equal(renewed.expiresAt,time+30*24*60*60*1000);
  time+=11*24*60*60*1000;
  assert.throws(()=>auth.session(first),{status:401});
  assert.equal(auth.session({sessionToken:renewed.sessionToken}).email,'player@example.com');
});

test('first-party email auth accepts a Persian username and trims the email address',async()=>{
  let body;const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'  player@example.com ',name:'محمد آذر درخش'});const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});
  assert.equal(body.to[0].email,'player@example.com');assert.equal(auth.session(verified).username,'محمد آذر درخش');
});

test('registration rejects under-13 and impossible birth dates before emailing a code',async()=>{
  let delivered=0;
  const store={enabled:true,status:{},findByEmail:async()=>null,findByUsername:async()=>null};
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async()=>{delivered++;return {ok:true};}});
  const now=new Date();
  const under13=new Date(Date.UTC(now.getUTCFullYear()-12,now.getUTCMonth(),now.getUTCDate())).toISOString().slice(0,10);
  const profile={firstName:'Alex',lastName:'Morgan',birthDate:under13,username:'alex_guard',password:'StrongPass1'};
  await assert.rejects(()=>auth.start({emailAddress:'player@example.com',profile}),{status:400});
  await assert.rejects(()=>auth.start({emailAddress:'player@example.com',profile:{...profile,birthDate:'2000-02-30'}}),{status:400});
  assert.equal(delivered,0);
});

test('profile signup hashes a valid password and creates a persistent account only after the email code',async()=>{
  let body,created;const store={enabled:true,status:{hasUrl:true,hasServiceKey:true},findByEmail:async()=>null,findByUsername:async()=>null,create:async profile=>{created=profile;return {...profile,id:'account-1'};}};const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'player@example.com',profile:{firstName:'محمد',lastName:'آذر درخش',birthDate:'2000-01-01',username:'محمد Guard',password:'StrongPass1'}});assert.equal(created,undefined);const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});
  assert.match(created.passwordHash,/^scrypt\$/);assert.equal(created.passwordHash.includes('StrongPass1'),false);assert.equal(auth.session(verified).firstName,'محمد');
});

test('profile signup identifies an existing email and username before it sends a code',async()=>{
  let sends=0;const emailAccount={id:'email-1',email:'used@example.com',username:'used_name'};const usernameAccount={id:'user-1',email:'other@example.com',username:'taken_name'};const store={enabled:true,status:{hasUrl:true,hasServiceKey:true},findByEmail:async value=>value===emailAccount.email?emailAccount:null,findByUsername:async value=>value===usernameAccount.username?usernameAccount:null,create:async()=>{throw new Error('not reached');}};const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async()=>{sends++;return {ok:true};}});const profile={firstName:'Alex',lastName:'Morgan',birthDate:'2000-01-01',username:'fresh_name',password:'StrongPass1'};
  await assert.rejects(()=>auth.start({emailAddress:'used@example.com',profile}),{status:409,message:'This email is already registered. Sign in instead.'});
  await assert.rejects(()=>auth.start({emailAddress:'new@example.com',profile:{...profile,username:'taken_name'}}),{status:409,message:'This username is already taken. Choose another username.'});
  assert.equal(sends,0);
  assert.deepEqual(await auth.availability({emailAddress:'used@example.com',username:'taken_name'}),{email:'taken',username:'taken'});
  assert.deepEqual(await auth.availability({emailAddress:'new@example.com',username:'fresh_name'}),{email:'available',username:'available'});
});

test('verification email includes a readable code, expiry and plain-text alternative',async()=>{
  let sent;const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:{enabled:false,status:{}},fetchImpl:async(_,options)=>{sent=JSON.parse(options.body);return {ok:true};}});
  await auth.start({emailAddress:'player@example.com'});
  const code=sent.htmlContent.match(/>(\d{6})</)?.[1];assert.match(code,/^[0-9]{6}$/);assert.ok(sent.textContent.includes(code));assert.match(sent.htmlContent,/expires in 10 minutes/);assert.match(sent.htmlContent,/select the six digits above/);assert.match(sent.textContent,/Never share/);
});

test('welcome template contains useful links and no account data',async()=>{
  const {welcomeEmail}=await import('./auth-email-template.js');const message=welcomeEmail();
  assert.equal(message.subject,'Welcome to MalGuard');assert.match(message.htmlContent,/If the button does not open/);assert.match(message.htmlContent,/https:\/\/malguard\.site\/ai\//);assert.match(message.textContent,/privacy/);assert.doesNotMatch(JSON.stringify(message),/sessionToken|verificationToken/);
});

test('a new MalGuard account receives a welcome email and a code-only sign-in does not',async()=>{
  const sent=[];const store={enabled:true,status:{hasUrl:true,hasServiceKey:true},findByEmail:async()=>null,findByUsername:async()=>null,create:async profile=>({...profile,id:'account-1'})};
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async(_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}});
  const profile={firstName:'Alex',lastName:'Morgan',birthDate:'2000-01-01',username:'alex_guard',password:'StrongPass1'};
  const started=await auth.start({emailAddress:'player@example.com',profile});
  assert.equal(sent[0].sender.name,'MalGuard');assert.equal(sent[0].subject,'Your MalGuard verification code');assert.doesNotMatch(JSON.stringify(sent[0]),/GameScam Guard/);
  const code=sent[0].htmlContent.match(/>(\d{6})</)[1];
  await auth.verify({verificationToken:started.verificationToken,code});
  assert.equal(sent.length,2);assert.equal(sent[1].subject,'Welcome to MalGuard');assert.equal(sent[1].sender.name,'MalGuard');assert.match(sent[1].htmlContent,/https:\/\/malguard\.site\/ai\//);assert.doesNotMatch(JSON.stringify(sent[1]),/StrongPass1|sessionToken|verificationToken|scrypt/);
  const codeStart=await auth.start({emailAddress:'player@example.com'});const signinCode=sent.at(-1).htmlContent.match(/>(\d{6})</)[1];
  await auth.verify({verificationToken:codeStart.verificationToken,code:signinCode});
  assert.equal(sent.filter(message=>message.subject==='Welcome to MalGuard').length,1);
});

test('welcome mail failure still returns a session after the account is created',async()=>{
  let calls=0,code;const store={enabled:true,status:{},findByEmail:async()=>null,findByUsername:async()=>null,create:async profile=>({...profile,id:'account-2'})};
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async(_url,options)=>{calls++;const body=JSON.parse(options.body);code=body.htmlContent?.match(/>(\d{6})</)?.[1]||code;return {ok:calls===1};}});
  const started=await auth.start({emailAddress:'player@example.com',profile:{firstName:'Alex',lastName:'Morgan',birthDate:'2000-01-01',username:'alex_guard',password:'StrongPass1'}});
  const verified=await auth.verify({verificationToken:started.verificationToken,code});
  assert.match(verified.sessionToken,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);assert.equal(calls,2);
});

