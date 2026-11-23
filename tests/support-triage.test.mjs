import test from 'node:test';
import assert from 'node:assert/strict';
import {triageSupportCase} from '../services/support/server/support-triage.mjs';

test('Persian scanner report identifies actionable missing evidence without claiming repairs',()=>{
 const result=triageSupportCase({
  ticketKind:'bug',locale:'fa',text:'اسکنر در ویندوز ۱۱ وقتی فایل انتخاب می‌کنم خطا می‌دهد. نسخه ۱.۳.۲'
 });
 assert.equal(result.category,'scan');
 assert.equal(result.source,'deterministic-server-rule');
 assert.equal(result.modelUsed,false);
 assert.equal(result.actionTaken,'none');
 assert.equal(result.needsPrivateSecurityRoute,false);
 assert.ok(result.missingDetails.some(x=>x.includes('رفتار موردانتظار')));
 assert.ok(result.safeChecks.some(x=>x.includes('اسکنر')));
});

test('English network report suggests harmless checks, with no API calls',()=>{
 const r=triageSupportCase({text:'Windows 11 V1.3.2: connection timeout when scanning',locale:'en'});
 assert.equal(r.category,'network');
 assert.equal(r.needsPrivateSecurityRoute,false);
 assert.ok(r.safeChecks.every(x=>!x.toLowerCase().includes('disable firewall')));
});

test('possible security disclosures stop ordinary troubleshooting and route privately',()=>{
 for(const text of ['نشت اطلاعات و دسترسی غیرمجاز','I found a SQL injection security bug']){
  const r=triageSupportCase({text,ticketKind:'bug',locale:'en'});
  assert.equal(r.needsPrivateSecurityRoute,true);
  assert.equal(r.priority,'manual_security_review');
  assert.equal(r.safeChecks.length,0);
  assert.ok(r.notice.includes('private'));
 }
});

test('input fails closed on invalid kind or excessively large content',()=>{
 assert.throws(()=>triageSupportCase({text:'test',ticketKind:'security'}),/invalid_triage_input/);
 assert.throws(()=>triageSupportCase({text:'x'.repeat(6001)}),/invalid_triage_input/);
 assert.throws(()=>triageSupportCase({text:' '}),/invalid_triage_input/);
});
