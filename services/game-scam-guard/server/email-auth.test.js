import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailAuth} from './email-auth.js';
import {challengeFixture} from './test-support/challenge-fixture.mjs';

test('email verification codes do not depend on the non-cryptographic Math.random generator',async()=>{
  const original=Math.random;let body;
  Math.random=()=>{throw new Error('non_crypto_rng_called');};
  try{
    const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:{enabled:false,status:{}},fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
    const started=await auth.start({emailAddress:'player@example.com'});
    const code=body.htmlContent.match(/>(\d{6})</)?.[1];
    assert.match(code,/^[1-9]\d{5}$/);
    assert.ok((await auth.verify({...started,code})).sessionToken);
  }finally{Math.random=original;}
});

test('first-party email auth sends a code through Brevo and issues an expiring opaque session',async()=>{
  let body;const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',now:()=>1000,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'Player@Example.com',name:'player_guard',ip:'198.51.100.7'});
  assert.equal(auth.enabled,true);assert.equal(auth.status.hasApiKey,true);assert.equal(auth.status.hasFromEmail,true);assert.match(started.verificationToken,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);assert.equal(body.to[0].email,'player@example.com');
  const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});const session=auth.session(verified);
  assert.deepEqual(session,{email:'player@example.com',username:'player_guard',firstName:null,lastName:null,birthDate:null,expiresAt:1000+30*24*60*60*1000});
});

test('first-party email auth rejects bad codes and does not expose them in its responses',async()=>{
  const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async()=>({ok:true})});const started=await auth.start({emailAddress:'player@example.com',ip:'198.51.100.7'});
  await assert.rejects(async()=>auth.verify({verificationToken:started.verificationToken,code:'000000'}),{status:400});assert.deepEqual(Object.keys(started),['verificationToken']);
});

test('first-party email auth accepts a Persian username and trims the email address',async()=>{
  let body;const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'  player@example.com ',name:'محمد آذر درخش'});const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});
  assert.equal(body.to[0].email,'player@example.com');assert.equal(auth.session(verified).username,'محمد آذر درخش');
});

test('profile signup hashes a valid password and creates a persistent account only after the email code',async()=>{
  let body,created;const store={enabled:true,status:{hasUrl:true,hasServiceKey:true},findByEmail:async()=>null,findByUsername:async()=>null,create:async profile=>{created=profile;return {...profile,id:'account-1'};}};const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'player@example.com',profile:{firstName:'محمد',lastName:'آذر درخش',birthDate:'2000-01-01',username:'محمد Guard',password:'StrongPass1'}});assert.equal(created,undefined);const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=await auth.verify({verificationToken:started.verificationToken,code});
  assert.match(created.passwordHash,/^scrypt\$/);assert.equal(created.passwordHash.includes('StrongPass1'),false);assert.equal(auth.session(verified).firstName,'محمد');
});

test('profile signup identifies an existing email and username before it sends a code',async()=>{
  let sends=0;const emailAccount={id:'email-1',email:'used@example.com',username:'used_name'};const usernameAccount={id:'user-1',email:'other@example.com',username:'taken_name'};const store={enabled:true,status:{hasUrl:true,hasServiceKey:true},findByEmail:async value=>value===emailAccount.email?emailAccount:null,findByUsername:async value=>value===usernameAccount.username?usernameAccount:null,create:async()=>{throw new Error('not reached');}};const auth=createEmailAuth({challengeStore:challengeFixture(),apiKey:'x'.repeat(32),fromEmail:'guard@example.com',accountStore:store,fetchImpl:async()=>{sends++;return {ok:true};}});const profile={firstName:'Alex',lastName:'Morgan',birthDate:'2000-01-01',username:'fresh_name',password:'StrongPass1'};
  await assert.rejects(()=>auth.start({emailAddress:'used@example.com',profile}),{status:409,message:'This email is already registered. Sign in instead.'});
  await assert.rejects(()=>auth.start({emailAddress:'new@example.com',profile:{...profile,username:'taken_name'}}),{status:409,message:'This username is already taken. Choose another username.'});
  assert.equal(sends,0);
  assert.deepEqual(await auth.availability({emailAddress:'used@example.com',username:'taken_name'}),{email:'taken',username:'taken'});
  assert.deepEqual(await auth.availability({emailAddress:'new@example.com',username:'fresh_name'}),{email:'available',username:'available'});
});
