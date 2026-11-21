-- Isolated Cloudflare D1 ticket store. No duplicate MalGuard user accounts.
-- Authentication remains delegated to the existing first-party MalGuard session API.
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  owner_email TEXT NOT NULL CHECK(length(owner_email) BETWEEN 3 AND 254 AND owner_email=lower(owner_email)),
  kind TEXT NOT NULL CHECK(kind IN ('bug','false-positive','feedback')),
  routing TEXT NOT NULL CHECK(routing IN ('agent','expert')),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  attachments_delete_at TEXT
);
CREATE INDEX IF NOT EXISTS support_tickets_email_created_idx ON support_tickets(owner_email,created_at DESC);
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK(author_kind IN ('reporter','expert','support-agent','system')),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 6000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx ON support_messages(ticket_id,created_at DESC);
CREATE TABLE IF NOT EXISTS support_rate_limits (
  rate_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
