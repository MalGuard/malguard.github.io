import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {suggestAvailableUsername,usernameStem} from '../assets/unique-username.mjs';

const random={getRandomValues(values){values[0]=0x12345678;return values;}};
test('name normalization preserves Unicode letters and enforces safe length',()=>{
 assert.equal(usernameStem(' علی ', ' محمدی '),'علی_محمدی');
 assert.equal(usernameStem('😀','💫'),'MalGuard_User');
 assert.ok(usernameStem('x'.repeat(100),'y'.repeat(100)).length<=40);
});
test('first candidate is used if server reports it available, without random suffix',async()=>{
 const tried=[];
 const selected=await suggestAvailableUsername({firstName:'Ali',lastName:'Mohammadi',check:async n=>{tried.push(n);return 'available';},random});
 assert.equal(selected,'Ali_Mohammadi');
 assert.deepEqual(tried,['Ali_Mohammadi']);
});
test('taken username triggers a fresh dice suffix and verified second attempt',async()=>{
 const tried=[];
 const selected=await suggestAvailableUsername({firstName:'Ali',lastName:'Mohammadi',check:async n=>{tried.push(n);return tried.length===1?'taken':'available';},random});
 assert.equal(tried.length,2);
 assert.notEqual(selected,tried[0]);
 assert.ok(/^Ali_Mohammadi_[a-z0-9]{7}$/.test(selected));
});
test('an API outage never silently selects a username',async()=>{
 await assert.rejects(()=>suggestAvailableUsername({firstName:'Ali',check:async()=>{throw Error('provider secret');},random}),/USERNAME_AVAILABILITY_UNVERIFIED/);
 await assert.rejects(()=>suggestAvailableUsername({firstName:'Ali',check:async()=>undefined,random}),/USERNAME_AVAILABILITY_UNVERIFIED/);
});
test('all names taken or duplicate RNG stop at bounded attempts',async()=>{
 let count=0;
 await assert.rejects(()=>suggestAvailableUsername({firstName:'Ali',check:async()=>{count++;return 'taken';},random,maxAttempts:6}),/USERNAME_NO_AVAILABLE_SUGGESTION/);
 assert.equal(count,2); // identical random output is not probed repeatedly
});
test('generated name fits backend 3-48 character constraints',async()=>{
 const value=await suggestAvailableUsername({firstName:'x'.repeat(200),lastName:'y'.repeat(200),check:async n=>n.length<45?'taken':'available',random});
 assert.ok(value.length>=3 && value.length<=48);
 assert.match(value,/^[\p{L}\p{N}][\p{L}\p{N} _-]*[\p{L}\p{N}]$/u);
});
test('both signup flows show a compact dice beside username label',async()=>{
 const [react,ai,css,dark]=await Promise.all([
  readFile('services/game-scam-guard/src/AccountDialog.jsx','utf8'),
  readFile('ai/account.mjs','utf8'),
  readFile('services/game-scam-guard/src/styles.css','utf8'),
  readFile('ai/pro-ui.css','utf8')
 ]);
 assert.ok(react.includes('className="username-heading"'));
 assert.ok(react.includes('<Dices size={16}'));
 assert.ok(react.includes('aria-label="Roll the dice"'));
 assert.ok(react.includes('suggestAvailableUsername({'));
 assert.ok(react.includes("checkAccountAvailability({email:'',username:suggested})"));
 assert.ok(ai.includes("usernameHeading.append(usernameTitle)"));
 assert.ok(ai.includes("action(usernameHeading,'🎲','🎲'"));
 assert.ok(ai.includes("request('availability',{email:'',username:candidate})"));
 assert.ok(css.includes('.username-heading .username-suggestion'));
 assert.ok(dark.includes('body.mg-pro .ai-account .username-heading .account-suggestion'));
});
