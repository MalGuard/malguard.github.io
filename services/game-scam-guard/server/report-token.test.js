import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportTokens } from './report-token.js';

const report = {id:'report-id',files:[{url:'https://example.com/mod.zip'}],preview:{status:'done',detail:'Passive image',image:'large-image'}};
const secret = 'fixture-secret-for-two-independent-instances';

test('a report continues across independent instances without exposing URLs or embedding screenshots', () => {
  const first = createReportTokens({secret,now:()=>1000});
  const other = createReportTokens({secret,now:()=>2000});
  const token = first.issue(report);
  const restored = other.read(token,report.id);
  assert.equal(restored.result.files[0].url,report.files[0].url);
  assert.equal(restored.result.preview.image,undefined);
  assert.ok(!token.includes('example.com'));
});

test('tampering, substituted report IDs, a different secret and expired report tokens are rejected', () => {
  const first = createReportTokens({secret,now:()=>1000});
  const token = first.issue(report);
  const bytes = Buffer.from(token.slice(3),'base64url'); bytes[28] ^= 1;
  assert.throws(()=>first.read('r1.'+bytes.toString('base64url'),report.id),/نامعتبر/);
  assert.throws(()=>first.read(token,'another-report'),/نامعتبر/);
  assert.throws(()=>createReportTokens({secret:'different-fixture-secret-for-instance'}).read(token,report.id),/نامعتبر/);
  assert.throws(()=>createReportTokens({secret,now:()=>1801000}).read(token,report.id),/منقضی/);
});
