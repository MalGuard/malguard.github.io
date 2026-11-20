-- MalGuard Support Agent: foundation schema (review before running in Supabase).
-- Prerequisite: public.guard_accounts must already exist.
-- All access is via a trusted, authenticated server using the service role;
-- anon/authenticated clients get no direct table access.
BEGIN;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL CHECK (length(owner_email) BETWEEN 3 AND 254 AND owner_email = lower(owner_email)),
  owner_account_id uuid NULL REFERENCES public.guard_accounts(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('bug','security','false-positive','feedback')),
  routing text NOT NULL DEFAULT 'agent' CHECK (routing IN ('agent','expert')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'open' CHECK (status IN
    ('open','investigating','awaiting_approval','testing','resolved','closed')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  attachments_delete_at timestamptz,
  closed_by text CHECK (closed_by IN ('reporter','admin')),
  close_reason text CHECK (length(close_reason) <= 500),
  CONSTRAINT support_tickets_closed_consistency CHECK (
    (status = 'closed' AND closed_at IS NOT NULL AND attachments_delete_at = closed_at + interval '30 days')
    OR (status <> 'closed' AND closed_at IS NULL AND attachments_delete_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS support_tickets_owner_idx ON public.support_tickets (owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_cleanup_idx ON public.support_tickets (attachments_delete_at)
  WHERE status = 'closed';

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_kind text NOT NULL CHECK (author_kind IN ('reporter','support-agent','expert','admin','system')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 12000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id,created_at);

CREATE TABLE IF NOT EXISTS public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','log')),
  content_type text NOT NULL,
  original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 120),
  file_bytes integer NOT NULL CHECK (file_bytes BETWEEN 1 AND 5242880),
  part_count integer NOT NULL CHECK (part_count BETWEEN 1 AND 16),
  reviewed_at timestamptz NOT NULL,
  original_object_key text NOT NULL,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[a-f0-9]{64}$'),
  sanitized_object_key text,
  sanitized_sha256 text CHECK (sanitized_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','quarantined','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT support_deleted_consistency CHECK (state <> 'deleted' OR deleted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx ON public.support_attachments(ticket_id,state);

CREATE TABLE IF NOT EXISTS public.support_attachment_parts (
  attachment_id uuid NOT NULL REFERENCES public.support_attachments(id) ON DELETE CASCADE,
  part_index integer NOT NULL CHECK (part_index BETWEEN 0 AND 15),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 524288),
  part_sha256 text NOT NULL CHECK (part_sha256 ~ '^[a-f0-9]{64}

CREATE TABLE IF NOT EXISTS public.support_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN
    ('attachment_analysis','private_repo_read','private_code_model_send','code_change','deployment')),
  resource_id text NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 300),
  approved_redacted_sha256 text CHECK (approved_redacted_sha256 ~ '^[a-f0-9]{64}$'),
  processor text,
  grantor_kind text NOT NULL CHECK (grantor_kind IN ('reporter','admin')),
  approved boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_permissions_ticket_idx ON public.support_permissions(ticket_id,kind,resource_id);

CREATE TABLE IF NOT EXISTS public.support_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_access_links_ticket_idx ON public.support_access_links(ticket_id,expires_at);

CREATE TABLE IF NOT EXISTS public.support_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  reviewer text NOT NULL CHECK (reviewer IN ('security','quality')),
  verdict text NOT NULL CHECK (verdict IN ('approved','rejected','inconclusive')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id,commit_sha,reviewer)
);

CREATE TABLE IF NOT EXISTS public.support_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (length(event_kind) BETWEEN 1 AND 100),
  actor_kind text NOT NULL CHECK (actor_kind IN ('reporter','admin','agent','system')),
  actor_id text,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_audit_ticket_idx ON public.support_audit_events(ticket_id,created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachment_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_events ENABLE ROW LEVEL SECURITY;

-- No permissive RLS policies: application-layer owner checks are mandatory.
REVOKE ALL ON public.support_tickets, public.support_messages, public.support_attachments,
  public.support_permissions, public.support_access_links, public.support_reviews,
  public.support_audit_events, public.support_attachment_parts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.support_audit_events_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
),
  object_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(attachment_id,part_index)
);


CREATE TABLE IF NOT EXISTS public.support_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN
    ('attachment_analysis','private_repo_read','private_code_model_send','code_change','deployment')),
  resource_id text NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 300),
  approved_redacted_sha256 text CHECK (approved_redacted_sha256 ~ '^[a-f0-9]{64}$'),
  processor text,
  grantor_kind text NOT NULL CHECK (grantor_kind IN ('reporter','admin')),
  approved boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_permissions_ticket_idx ON public.support_permissions(ticket_id,kind,resource_id);

CREATE TABLE IF NOT EXISTS public.support_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_access_links_ticket_idx ON public.support_access_links(ticket_id,expires_at);

CREATE TABLE IF NOT EXISTS public.support_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  commit_sha text NOT NULL CHECK (commit_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
  reviewer text NOT NULL CHECK (reviewer IN ('security','quality')),
  verdict text NOT NULL CHECK (verdict IN ('approved','rejected','inconclusive')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id,commit_sha,reviewer)
);

CREATE TABLE IF NOT EXISTS public.support_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (length(event_kind) BETWEEN 1 AND 100),
  actor_kind text NOT NULL CHECK (actor_kind IN ('reporter','admin','agent','system')),
  actor_id text,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_audit_ticket_idx ON public.support_audit_events(ticket_id,created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_events ENABLE ROW LEVEL SECURITY;

-- No permissive RLS policies: application-layer owner checks are mandatory.
REVOKE ALL ON public.support_tickets, public.support_messages, public.support_attachments,
  public.support_permissions, public.support_access_links, public.support_reviews,
  public.support_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.support_audit_events_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
