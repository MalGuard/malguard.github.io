// Create and validate single-ticket email link challenges.
// Store only tokenHash. Mail the raw token once; do not log it or put it in query params.
// The HTTP handler must atomically set consumed_at in persistent storage before granting a session.
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

export const EMAIL_LINK_TTL_MS = 15 * 60 * 1000;
const digest = input => createHash('sha256').update(input, 'utf8').digest();
const normalized = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function issueEmailLink(ticket, at = Date.now()) {
  if (!ticket?.id || !normalized(ticket.ownerEmail) || !Number.isSafeInteger(at) || at < 0)
    throw new TypeError('invalid_ticket_or_time');
  const token = randomBytes(32).toString('base64url');
  const tokenHash = digest(token).toString('hex');
  return {
    token,
    record: {
      ticketId: ticket.id,
      email: normalized(ticket.ownerEmail),
      tokenHash,
      createdAt: new Date(at).toISOString(),
      expiresAt: new Date(at + EMAIL_LINK_TTL_MS).toISOString(),
      consumedAt: null,
      revokedAt: null
    }
  };
}

export function verifyEmailLink(token, record, ticket, at = Date.now()) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      !record || !ticket || record.ticketId !== ticket.id ||
      record.email !== normalized(ticket.ownerEmail) ||
      record.consumedAt != null || record.revokedAt != null ||
      !Number.isSafeInteger(at) || at < 0) return false;
  const expires = Date.parse(record.expiresAt);
  if (!Number.isFinite(expires) || at >= expires ||
      typeof record.tokenHash !== 'string' || !/^[0-9a-f]{64}$/.test(record.tokenHash)) return false;
  const actual = digest(token);
  const expected = Buffer.from(record.tokenHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
