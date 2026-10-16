import assert from 'node:assert/strict';
import test from 'node:test';
import { resendEmailCode, sendEmailCode, verifyEmailCode } from './email-account.js';

test('sign-up creates the requested username and password, then prepares an email code', async () => {
  const calls=[];
  const attempt={
    prepareEmailAddressVerification:async options=>{calls.push(['prepare',options]);return attempt;},
    attemptEmailAddressVerification:async options=>{calls.push(['verify',options]);return {status:'complete',createdSessionId:'session_1'};}
  };
  const clerk={client:{signUp:{create:async options=>{calls.push(['create',options]);return attempt;}}},setActive:async options=>{calls.push(['active',options]);clerk.session={id:options.session};clerk.user={id:'user_1'};}};
  assert.equal(await sendEmailCode(clerk,'signup',{username:'player_guard',email:'player@example.com',password:'a safe test password'}),attempt);
  assert.deepEqual(calls,[['create',{username:'player_guard',emailAddress:'player@example.com',password:'a safe test password'}],['prepare',{strategy:'email_code'}]]);
  assert.deepEqual(await verifyEmailCode(clerk,attempt,'signup','123456'),{id:'user_1'});
  assert.deepEqual(calls.at(-2),['verify',{code:'123456'}]);
  assert.deepEqual(calls.at(-1),['active',{session:'session_1'}]);
});

test('email-only sign-in uses its email-code factor and rejects malformed codes', async () => {
  const calls=[];
  const attempt={
    supportedFirstFactors:[{strategy:'email_code',emailAddressId:'id_email'}],
    prepareFirstFactor:async options=>{calls.push(['prepare',options]);return attempt;},
    attemptFirstFactor:async options=>{calls.push(['verify',options]);return {status:'complete',createdSessionId:'session_2'};}
  };
  const clerk={client:{signIn:{create:async options=>{calls.push(['create',options]);return attempt;}}},setActive:async options=>{calls.push(['active',options]);clerk.session={id:options.session};clerk.user={id:'user_2'};}};
  assert.equal(await sendEmailCode(clerk,'signin','player@example.com'),attempt);
  assert.deepEqual(calls,[['create',{identifier:'player@example.com'}],['prepare',{strategy:'email_code',emailAddressId:'id_email'}]]);
  assert.equal(await resendEmailCode(attempt,'signin'),attempt);
  await assert.rejects(()=>verifyEmailCode(clerk,attempt,'signin','12x456'),{code:'invalid_code'});
  assert.deepEqual(await verifyEmailCode(clerk,attempt,'signin','123456'),{id:'user_2'});
  assert.deepEqual(calls.at(-2),['verify',{strategy:'email_code',code:'123456'}]);
  assert.deepEqual(calls.at(-1),['active',{session:'session_2'}]);
});

test('email sign-in fails closed when the provider has no email-code factor', async () => {
  const clerk={client:{signIn:{create:async()=>({supportedFirstFactors:[{strategy:'password'}]})}}};
  await assert.rejects(()=>sendEmailCode(clerk,'signin','player@example.com'),{code:'email_code_unavailable'});
});
