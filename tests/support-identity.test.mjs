import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupportIdentity} from '../services/support/server/support-identity.mjs';
import {createSupportMailer,createChallengeVerifier} from '../services/support/server/support-mail.mjs';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const start=Date.parse('2026-11-20T00:00:00Z');

test('ticket session has valid short TTL and tampering or expiry is rejected',()=>{
  let current=start;
  const identity=createSupportIdentity({auth:{enabled:false},accounts:{enabled:false},
    secret:'s'.repeat(64),now:()=>current});
  const {accessToken,expiresAt}=identity.issueTicketSession({ticketId:A,email:'Owner@Example.test'});
  assert.equal(Date.parse(expiresAt)-start,30*60000);
  const actor=identity.linkActor(accessToken);
  assert.deepEqual({ticketId:actor.ticketId,email:actor.email,method:actor.method},
    {ticketId:A,email:'owner@example.test',method:'email-link'});
  assert.throws(()=>identity.linkActor(accessToken.slice(0,-1)+(accessToken.endsWith('x')?'y':'x')),/unauthorized/);
  current=start+30*60000;
  assert.throws(()=>identity.linkActor(accessToken),/unauthorized/);
  current=start-1;
  assert.throws(()=>identity.linkActor(accessToken),/unauthorized/);
});

test('accounts must exist in persistent MalGuard account table even with a decryptable session',async()=>{
  const accountId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const account={id:accountId,email:'owner@example.test'};
  let found=true;
  const identity=createSupportIdentity({
    auth:{enabled:true,session:({sessionToken})=>{
      if(sessionToken!=='valid-synthetic-account-session-0123456789')throw Error('invalid');
      return {email:'owner@example.test',expiresAt:start+5000};
    }},
    accounts:{enabled:true,findByEmail:async()=>found?account:null},
    secret:'s'.repeat(64),now:()=>start
  });
  assert.equal((await identity.accountActor('valid-synthetic-account-session-0123456789')).accountId,accountId);
  found=false;
  await assert.rejects(identity.accountActor('valid-synthetic-account-session-0123456789'),/unauthorized/);
  await assert.rejects(identity.accountActor('invalid-synthetic-account-session-0123456789'),/unauthorized/);
});

test('public landing URL must be first-party HTTPS; provider acknowledgement is not delivery',async()=>{
  const sent=[];
  const mailer=createSupportMailer({
    apiKey:'x'.repeat(32),fromEmail:'contact@malguard.site',
    publicUrl:'https://malguard.site/support-ticket.html',
    fetchImpl:async(url,options)=>{
      sent.push({url,body:JSON.parse(options.body)});
      return {ok:true};
    }
  });
  assert.equal(mailer.enabled,true);
  await mailer.sendTicketLink({email:'user@example.test',ticketId:A,token:'z'.repeat(43)});
  assert.equal(sent.length,1);
  assert.ok(sent[0].body.textContent.includes('#ticket='));
  assert.equal(sent[0].body.to[0].email,'user@example.test');
  assert.equal(createSupportMailer({apiKey:'x'.repeat(32),fromEmail:'contact@malguard.site',
    publicUrl:'https://evil.invalid/support-ticket.html'}).enabled,false);
  assert.equal(createSupportMailer({apiKey:'x'.repeat(32),fromEmail:'contact@malguard.site',
    publicUrl:'http://malguard.site/support-ticket.html'}).enabled,false);
});

test('Turnstile requires official hostname, matching action and server validation',async()=>{
  let answer={success:true,action:'support_create',hostname:'malguard.site'};
  const verifier=createChallengeVerifier({secret:'a'.repeat(40),
    fetchImpl:async()=>({ok:true,json:async()=>answer})});
  assert.equal(await verifier.verify('fake-test-response','support_create'),true);
  answer={...answer,hostname:'evil.invalid'};
  assert.equal(await verifier.verify('fake-test-response','support_create'),false);
  answer={...answer,hostname:'malguard.site',action:'support_request_link'};
  assert.equal(await verifier.verify('fake-test-response','support_create'),false);
  assert.equal(await verifier.verify('short','support_create'),false);
});
