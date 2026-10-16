import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailAuth} from './email-auth.js';

test('first-party email auth sends a code through Brevo and issues an expiring opaque session',async()=>{
  let body;const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',now:()=>1000,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'Player@Example.com',name:'player_guard',ip:'198.51.100.7'});
  assert.equal(auth.enabled,true);assert.deepEqual(auth.status,{hasApiKey:true,hasFromEmail:true});assert.match(started.verificationToken,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);assert.equal(body.to[0].email,'player@example.com');
  const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=auth.verify({verificationToken:started.verificationToken,code});const session=auth.session(verified);
  assert.deepEqual(session,{email:'player@example.com',username:'player_guard',expiresAt:1000+30*24*60*60*1000});
});

test('first-party email auth rejects bad codes and does not expose them in its responses',async()=>{
  const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async()=>({ok:true})});const started=await auth.start({emailAddress:'player@example.com',ip:'198.51.100.7'});
  await assert.rejects(async()=>auth.verify({verificationToken:started.verificationToken,code:'000000'}),{status:400});assert.deepEqual(Object.keys(started),['verificationToken']);
});

test('first-party email auth accepts a Persian username and trims the email address',async()=>{
  let body;const auth=createEmailAuth({apiKey:'x'.repeat(32),fromEmail:'guard@example.com',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true};}});
  const started=await auth.start({emailAddress:'  player@example.com ',name:'محمد آذر درخش'});const code=body.htmlContent.match(/>(\d{6})</)[1];const verified=auth.verify({verificationToken:started.verificationToken,code});
  assert.equal(body.to[0].email,'player@example.com');assert.equal(auth.session(verified).username,'محمد آذر درخش');
});
