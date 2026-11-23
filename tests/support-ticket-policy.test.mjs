import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REOPEN_WINDOW_MS, ATTACHMENT_RETENTION_MS, TicketPolicyError,
  canAccessTicket, closeTicket, reopenTicket, attachmentsDueForDeletion,
  canAnalyzeAttachment, readyForRelease
} from '../services/support/server/ticket-policy.mjs';

const stamp = Date.parse('2026-11-20T00:00:00.000Z');
const ticket = () => ({
  id: 'ticket-a', ownerEmail: 'Owner@Example.test', status: 'open',
  createdAt: new Date(stamp).toISOString(), revision: 0,
  closedAt: null, attachmentsDeleteAt: null
});
const owner = {verified: true, method: 'account', email: 'owner@example.test'};
const emailLink = {verified: true, method: 'email-link', email: 'owner@example.test', ticketId: 'ticket-a'};
const admin = {verified: true, method: 'admin', role: 'support-admin', permission: 'support:manage'};
const forbidden = code => err => err instanceof TicketPolicyError && err.code === code;

test('ticket access is fail-closed and email links are ticket scoped', () => {
  assert.equal(canAccessTicket(ticket(), owner), true);
  assert.equal(canAccessTicket(ticket(), emailLink), true);
  assert.equal(canAccessTicket(ticket(), {...emailLink, ticketId: 'ticket-b'}), false);
  assert.equal(canAccessTicket(ticket(), {...owner, verified: false}), false);
  assert.equal(canAccessTicket(ticket(), {...owner, email: 'other@example.test'}), false);
  assert.equal(canAccessTicket(ticket(), {...admin, verified: false}), false);
  assert.equal(canAccessTicket(ticket(), {...admin, permission: 'support:read'}), false);
  assert.equal(canAccessTicket(ticket(), admin), true);
  assert.throws(() => closeTicket(ticket(), {role: 'support-admin'}, stamp + 1000, 'ok'), forbidden('forbidden'));
});

test('closing records a server time and the 30-day attachment deletion deadline', () => {
  const closed = closeTicket(ticket(), owner, stamp + 5000);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedBy, 'reporter');
  assert.equal(Date.parse(closed.attachmentsDeleteAt) - Date.parse(closed.closedAt), ATTACHMENT_RETENTION_MS);
  assert.equal(attachmentsDueForDeletion(closed, Date.parse(closed.attachmentsDeleteAt) - 1), false);
  assert.equal(attachmentsDueForDeletion(closed, closed.attachmentsDeleteAt), true);
  assert.equal(closed.revision, 1);
  assert.throws(() => closeTicket(closed, owner, stamp + 6000), forbidden('already_closed'));
});

test('admin must explain closure; support agent cannot close', () => {
  assert.throws(() => closeTicket(ticket(), admin, stamp + 100, '  '), forbidden('admin_close_reason_required'));
  assert.throws(() => closeTicket(ticket(), {verified: true, method: 'agent', role: 'support-admin'}, stamp + 100), forbidden('forbidden'));
  const closed = closeTicket(ticket(), admin, stamp + 100, 'Fixed after QA');
  assert.equal(closed.closeReason, 'Fixed after QA');
});

test('reopening exactly at 7 days works, then permission expires', () => {
  const closed = closeTicket(ticket(), owner, stamp + 1000);
  const windowEnd = Date.parse(closed.closedAt) + REOPEN_WINDOW_MS;
  const reopened = reopenTicket(closed, emailLink, windowEnd);
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.closedAt, null);
  assert.equal(reopened.attachmentsDeleteAt, null);
  assert.equal(attachmentsDueForDeletion(reopened, windowEnd + ATTACHMENT_RETENTION_MS), false);
  assert.throws(() => reopenTicket(closed, owner, windowEnd + 1), forbidden('reopen_window_expired'));
  assert.throws(() => reopenTicket(closed, {...emailLink, ticketId: 'ticket-b'}, windowEnd), forbidden('forbidden'));
  assert.throws(() => reopenTicket(closed, admin, windowEnd), forbidden('forbidden'));
  const reclosed = closeTicket(reopened, owner, windowEnd + 1000);
  assert.equal(Date.parse(reclosed.attachmentsDeleteAt), windowEnd + 1000 + ATTACHMENT_RETENTION_MS);
});

test('invalid timestamps and forged deletion deadlines fail closed', () => {
  assert.throws(() => closeTicket(ticket(), owner, stamp - 1), forbidden('invalid_time'));
  assert.throws(() => closeTicket(ticket(), owner, 'not-a-time'), forbidden('invalid_time'));
  const closed = closeTicket(ticket(), owner, stamp + 1);
  assert.equal(attachmentsDueForDeletion({...closed, attachmentsDeleteAt: new Date(stamp + 2).toISOString()}, stamp + 100000), false);
});

test('only user-approved exact redacted attachment version is available to support AI', () => {
  const hash = 'a'.repeat(64);
  const attachment = {id: 'file-a', ticketId: 'ticket-a', state: 'ready', redactedSha256: hash};
  const consent = {ticketId: 'ticket-a', attachmentId: 'file-a', processor: 'support-agent',
    redactedSha256: hash, approved: true, confirmedAt: new Date(stamp).toISOString(), revokedAt: null};
  assert.equal(canAnalyzeAttachment(ticket(), attachment, consent, owner), true);
  assert.equal(canAnalyzeAttachment(ticket(), attachment, {...consent, revokedAt: new Date(stamp + 1).toISOString()}, owner), false);
  assert.equal(canAnalyzeAttachment(ticket(), attachment, {...consent, redactedSha256: 'b'.repeat(64)}, owner), false);
  assert.equal(canAnalyzeAttachment(ticket(), attachment, {...consent, processor: 'security'}, owner), false);
  assert.equal(canAnalyzeAttachment(ticket(), {...attachment, ticketId: 'ticket-b'}, consent, owner), false);
  assert.equal(canAnalyzeAttachment(ticket(), attachment, consent, {...owner, verified: false}), false);
  assert.equal(canAnalyzeAttachment(closeTicket(ticket(), owner, stamp + 1), attachment, consent, owner), false);
});

test('release requires independent approvals, fixed SHA, owner and reporter consent and green CI', () => {
  const sha = 'c'.repeat(40) + 'd'.repeat(24);
  const sample = {commitSha: sha, reporterApproved: true, ownerChangeApproved: true,
    ownerDeployApproval: {approved: true, commitSha: sha},
    reviews: [{reviewer: 'security', verdict: 'approved', commitSha: sha},
      {reviewer: 'quality', verdict: 'approved', commitSha: sha}],
    requiredChecks: [{status: 'success', commitSha: sha}]};
  assert.equal(readyForRelease(sample), true);
  assert.equal(readyForRelease({...sample, reporterApproved: false}), false);
  assert.equal(readyForRelease({...sample, ownerDeployApproval: {approved: true, commitSha: 'a'.repeat(64)}}), false);
  assert.equal(readyForRelease({...sample, requiredChecks: []}), false);
  assert.equal(readyForRelease({...sample, requiredChecks: [{status: 'pending', commitSha: sha}]}), false);
  assert.equal(readyForRelease({...sample, reviews: [sample.reviews[0], sample.reviews[0]]}), false);
  assert.equal(readyForRelease({...sample, reviews: [sample.reviews[0], {...sample.reviews[1], verdict: 'rejected'}]}), false);
  assert.equal(readyForRelease({...sample, reviews: [sample.reviews[0], {...sample.reviews[1], commitSha: 'f'.repeat(64)}]}), false);
});
