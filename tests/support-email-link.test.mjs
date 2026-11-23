import test from 'node:test';
import assert from 'node:assert/strict';
import {issueEmailLink,verifyEmailLink,EMAIL_LINK_TTL_MS} from '../services/support/server/email-link.mjs';

const start = Date.parse('2026-11-20T01:00:00Z');
const ticket = {id:'ticket-a',ownerEmail:'User@Example.test'};
test('email token is random, ticket-bound and stored only as its hash', () => {
  const first = issueEmailLink(ticket,start);
  const second = issueEmailLink(ticket,start);
  assert.notEqual(first.token,second.token);
  assert.equal(first.record.email,'user@example.test');
  assert.notEqual(first.record.tokenHash,first.token);
  assert.equal(first.record.tokenHash.length,64);
  assert.equal(verifyEmailLink(first.token,first.record,ticket,start),true);
  assert.equal(verifyEmailLink(second.token,first.record,ticket,start),false);
  assert.equal(verifyEmailLink(first.token,first.record,{...ticket,id:'ticket-b'},start),false);
  assert.equal(verifyEmailLink(first.token,first.record,{...ticket,ownerEmail:'other@example.test'},start),false);
});

test('link expires after 15 minutes and cannot be used once consumed or revoked', () => {
  const {token,record} = issueEmailLink(ticket,start);
  assert.equal(verifyEmailLink(token,record,ticket,start + EMAIL_LINK_TTL_MS - 1),true);
  assert.equal(verifyEmailLink(token,record,ticket,start + EMAIL_LINK_TTL_MS),false);
  assert.equal(verifyEmailLink(token,{...record,consumedAt:new Date(start+5).toISOString()},ticket,start+10),false);
  assert.equal(verifyEmailLink(token,{...record,revokedAt:new Date(start+5).toISOString()},ticket,start+10),false);
  assert.equal(verifyEmailLink('invalid',{...record},ticket,start),false);
  assert.equal(verifyEmailLink(token,{...record,tokenHash:'deadbeef'},ticket,start),false);
});

test('malformed tickets or clock values fail closed', () => {
  assert.throws(()=>issueEmailLink({...ticket,id:null},start),TypeError);
  assert.throws(()=>issueEmailLink(ticket,-1),TypeError);
  const {token,record}=issueEmailLink(ticket,start);
  assert.equal(verifyEmailLink(token,record,ticket,NaN),false);
});
