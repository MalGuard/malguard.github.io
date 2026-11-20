// Pure policy layer for MalGuard Support. No client-provided roles are trusted here.
// HTTP handlers must construct actors only after server-side account/link/admin verification.
export const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const ATTACHMENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SHA256 = /^[0-9a-f]{64}$/i;

export class TicketPolicyError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.name = 'TicketPolicyError';
    this.code = code;
    this.status = status;
  }
}
const reject = (code, status) => { throw new TicketPolicyError(code, status); };
const time = value => {
  const number = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value;
  if (!Number.isSafeInteger(number) || number < 0) reject('invalid_time', 400);
  return number;
};
const mail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const isAdmin = actor => actor?.verified === true && actor.method === 'admin' &&
  actor.role === 'support-admin' && actor.permission === 'support:manage';
const isOwner = (ticket, actor) => {
  if (!ticket || actor?.verified !== true || mail(actor.email) !== mail(ticket.ownerEmail) ||
      !mail(ticket.ownerEmail)) return false;
  if (actor.method === 'account') return true;
  return actor.method === 'email-link' && actor.ticketId === ticket.id;
};

export function canAccessTicket(ticket, actor) {
  return isAdmin(actor) || isOwner(ticket, actor);
}

export function closeTicket(ticket, actor, at, reason) {
  if (!canAccessTicket(ticket, actor)) reject('forbidden');
  if (ticket.status === 'closed') reject('already_closed', 409);
  if (!['open', 'investigating', 'awaiting_approval', 'testing', 'resolved'].includes(ticket.status))
    reject('invalid_status', 409);
  const when = time(at);
  if (when < time(ticket.createdAt)) reject('invalid_time', 400);
  if (isAdmin(actor) && (typeof reason !== 'string' || !reason.trim() || reason.length > 500))
    reject('admin_close_reason_required', 400);
  return {
    ...ticket, status: 'closed', closedAt: new Date(when).toISOString(),
    attachmentsDeleteAt: new Date(when + ATTACHMENT_RETENTION_MS).toISOString(),
    updatedAt: new Date(when).toISOString(),
    closedBy: isAdmin(actor) ? 'admin' : 'reporter',
    closeReason: isAdmin(actor) ? reason.trim() : null,
    revision: (ticket.revision || 0) + 1
  };
}

export function reopenTicket(ticket, actor, at) {
  if (!isOwner(ticket, actor)) reject('forbidden');
  if (ticket.status !== 'closed' || !ticket.closedAt) reject('not_closed', 409);
  const when = time(at), closed = time(ticket.closedAt);
  if (when < closed) reject('invalid_time', 400);
  if (when > closed + REOPEN_WINDOW_MS) reject('reopen_window_expired', 409);
  // The persistence layer must cancel cleanup atomically with this transition.
  return {
    ...ticket, status: 'open', closedAt: null, attachmentsDeleteAt: null,
    closedBy: null, closeReason: null, updatedAt: new Date(when).toISOString(),
    revision: (ticket.revision || 0) + 1
  };
}

export function attachmentsDueForDeletion(ticket, at) {
  if (ticket?.status !== 'closed' || !ticket.closedAt || !ticket.attachmentsDeleteAt) return false;
  const closed = time(ticket.closedAt), due = time(ticket.attachmentsDeleteAt);
  return due === closed + ATTACHMENT_RETENTION_MS && time(at) >= due;
}

export function canAnalyzeAttachment(ticket, attachment, consent, actor) {
  // Permission is for one sanitized VERSION, one ticket and the Support Agent only.
  if (!isOwner(ticket, actor) || ticket.status === 'closed') return false;
  if (!attachment || attachment.ticketId !== ticket.id || attachment.state !== 'ready' ||
      !SHA256.test(attachment.redactedSha256 || '')) return false;
  if (!consent || consent.ticketId !== ticket.id || consent.attachmentId !== attachment.id ||
      consent.processor !== 'support-agent' || consent.approved !== true ||
      consent.revokedAt != null || !Number.isFinite(Date.parse(consent.confirmedAt || '')) ||
      consent.redactedSha256 !== attachment.redactedSha256) return false;
  return true;
}

export function readyForRelease(change) {
  // A UI badge or AI statement must never authorize a deployment by itself.
  if (!change || !SHA256.test(change.commitSha || '')) return false;
  if (change.reporterApproved !== true || change.ownerChangeApproved !== true) return false;
  if (change.ownerDeployApproval?.commitSha !== change.commitSha ||
      change.ownerDeployApproval?.approved !== true) return false;
  if (!Array.isArray(change.reviews) || change.reviews.length !== 2) return false;
  const names = change.reviews.map(r => r?.reviewer);
  if (new Set(names).size !== 2 ||
      !names.includes('security') || !names.includes('quality')) return false;
  if (!change.reviews.every(r => r.verdict === 'approved' && r.commitSha === change.commitSha))
    return false;
  return Array.isArray(change.requiredChecks) && change.requiredChecks.length > 0 &&
    change.requiredChecks.every(check => check?.status === 'success' && check.commitSha === change.commitSha);
}
