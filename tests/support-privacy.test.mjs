import test from 'node:test';
import assert from 'node:assert/strict';
import {redactLog,validateLogText,supportPrivacyLimits} from '../assets/support-privacy.mjs';
test('secrets, email, IP and URL query are redacted without losing error context',()=>{
 const input='ERROR scanner timeout\nemail=person@example.test ip=192.0.2.44\npassword=hunter2\nAuthorization: Bearer xxyyzz\nrequest=https://example.test/scan?token=secret';
 const result=redactLog(input);
 assert.match(result.redacted,/ERROR scanner timeout/);
 for(const privateText of ['person@example.test','192.0.2.44','hunter2','xxyyzz','token=secret'])
  assert.ok(!result.redacted.includes(privateText),privateText);
 assert.ok(result.replacements>=4);
 assert.equal(result.guaranteedClean,false);
});
test('limits and invalid control characters fail closed',()=>{
 assert.equal(supportPrivacyLimits.imageBytes,5*1024*1024);
 assert.equal(validateLogText('normal\nline'),true);
 assert.equal(validateLogText('text\u0000binary'),false);
 assert.equal(validateLogText('x'.repeat(supportPrivacyLimits.logBytes+1)),false);
 assert.throws(()=>redactLog('x'.repeat(supportPrivacyLimits.logBytes+1)),TypeError);
});
