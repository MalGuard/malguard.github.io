import assert from 'node:assert/strict';
import test from 'node:test';
import {sendEmailCode,verifyEmailCode,readEmailSession} from './email-account.js';

test('account client sends only signup profile data and carries opaque provider tokens',async()=>{
  const original=globalThis.fetch;const calls=[];globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>calls.length===1?{verificationToken:'opaque-code-ticket'}:calls.length===2?{sessionToken:'opaque-session'}:{email:'player@example.com',username:'player_guard'}};};
  try {assert.deepEqual(await sendEmailCode({email:'player@example.com',username:'player_guard'}),{verificationToken:'opaque-code-ticket'});assert.deepEqual(await verifyEmailCode({verificationToken:'opaque-code-ticket',code:'123456'}),{sessionToken:'opaque-session'});assert.deepEqual(await readEmailSession('opaque-session'),{email:'player@example.com',username:'player_guard'});assert.deepEqual(calls,[{email:'player@example.com',username:'player_guard'},{verificationToken:'opaque-code-ticket',code:'123456'},{sessionToken:'opaque-session'}]);}finally{globalThis.fetch=original;}
});
