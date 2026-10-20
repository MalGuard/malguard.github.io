import assert from 'node:assert/strict';
import test from 'node:test';
import {sendEmailCode,verifyEmailCode,signInWithPassword,readEmailSession,checkAccountAvailability} from './email-account.js';

test('account client sends only signup profile data and carries opaque provider tokens',async()=>{
  const original=globalThis.fetch;const calls=[];globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>calls.length===1?{verificationToken:'opaque-code-ticket'}:calls.length===2?{sessionToken:'opaque-session'}:calls.length===3?{sessionToken:'password-session'}:{email:'player@example.com',username:'player_guard'}};};
  try {const profile={firstName:'Player',lastName:'Guard',birthDate:'2000-01-01',username:'player_guard',password:'CorrectHorse1'};assert.deepEqual(await sendEmailCode({email:'player@example.com',profile}),{verificationToken:'opaque-code-ticket'});assert.deepEqual(await verifyEmailCode({verificationToken:'opaque-code-ticket',code:'123456'}),{sessionToken:'opaque-session'});assert.deepEqual(await signInWithPassword({email:'player@example.com',password:'CorrectHorse1'}),{sessionToken:'password-session'});assert.deepEqual(await readEmailSession('opaque-session'),{email:'player@example.com',username:'player_guard'});assert.deepEqual(calls,[{email:'player@example.com',profile},{verificationToken:'opaque-code-ticket',code:'123456'},{email:'player@example.com',password:'CorrectHorse1'},{sessionToken:'opaque-session'}]);}finally{globalThis.fetch=original;}
});


test('email and username availability uses the allowed first-party API endpoint',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.match(url,/auth\/availability$/);assert.deepEqual(JSON.parse(options.body),{email:'used@example.com',username:'player_guard'});return {ok:true,json:async()=>({email:'taken',username:'available'})};};
  try{assert.deepEqual(await checkAccountAvailability({email:'used@example.com',username:'player_guard'}),{email:'taken',username:'available'});}finally{globalThis.fetch=original;}
});
