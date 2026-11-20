-- Phase 1b: server-only atomic RPC functions. Apply AFTER support-schema.sql.
-- These are SECURITY INVOKER, callable ONLY with the trusted service_role.
-- Never expose service-role credentials to web clients.
BEGIN;
CREATE TABLE IF NOT EXISTS public.support_rate_limits (
  rate_key text PRIMARY KEY CHECK (rate_key ~ '^[a-f0-9]{64}$'),
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.support_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_rate_limits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.support_tickets, public.support_messages, public.support_attachments,
  public.support_permissions, public.support_access_links, public.support_reviews,
  public.support_audit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_audit_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.support_take_rate(p_key text, p_limit integer, p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_hits integer;
BEGIN
  IF p_key !~ '^[a-f0-9]{64}$' OR p_limit NOT BETWEEN 1 AND 100
     OR p_seconds NOT BETWEEN 60 AND 86400 THEN RETURN false; END IF;
  INSERT INTO public.support_rate_limits (rate_key, hits, expires_at)
    VALUES (p_key,1,now()+make_interval(secs=>p_seconds))
  ON CONFLICT (rate_key) DO UPDATE SET
    hits=CASE WHEN public.support_rate_limits.expires_at<=now()
      THEN 1 ELSE public.support_rate_limits.hits+1 END,
    expires_at=CASE WHEN public.support_rate_limits.expires_at<=now()
      THEN now()+make_interval(secs=>p_seconds) ELSE public.support_rate_limits.expires_at END
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.support_create_ticket(
  p_email text,p_account_id uuid,p_kind text,p_route text,p_subject text,p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.support_tickets(owner_email,owner_account_id,kind,routing,subject)
    VALUES(p_email,p_account_id,p_kind,p_route,p_subject)
    RETURNING id INTO v_id;
  INSERT INTO public.support_messages(ticket_id,author_kind,content)
    VALUES(v_id,'reporter',p_message);
  INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
    VALUES(v_id,'ticket.created','reporter');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.support_redeem_link(p_ticket_id uuid,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ticket uuid;v_email text;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  UPDATE public.support_access_links AS l SET consumed_at=now()
   WHERE l.ticket_id=p_ticket_id AND l.token_hash=p_token_hash AND l.consumed_at IS NULL
     AND l.revoked_at IS NULL AND l.expires_at>now()
     AND EXISTS (SELECT 1 FROM public.support_tickets AS t
       WHERE t.id=l.ticket_id AND t.owner_email=l.email)
   RETURNING l.ticket_id,l.email INTO v_ticket,v_email;
  IF v_ticket IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
    VALUES(v_ticket,'email_link.redeemed','reporter');
  RETURN jsonb_build_object('ticketId',v_ticket,'email',v_email);
END $$;

CREATE OR REPLACE FUNCTION public.support_append_message(
  p_ticket_id uuid,p_expected_revision bigint,p_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE;v_message_id uuid;
BEGIN
  UPDATE public.support_tickets SET revision=revision+1,updated_at=now()
   WHERE id=p_ticket_id AND revision=p_expected_revision AND status<>'closed'
   RETURNING * INTO v_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_conflict' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.support_messages(ticket_id,author_kind,content)
    VALUES(p_ticket_id,'reporter',p_content) RETURNING id INTO v_message_id;
  INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
    VALUES(p_ticket_id,'message.created','reporter');
  RETURN jsonb_build_object('messageId',v_message_id,'revision',v_ticket.revision);
END $$;

CREATE OR REPLACE FUNCTION public.support_close_ticket(
  p_ticket_id uuid,p_expected_revision bigint,p_actor text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF p_actor NOT IN ('reporter','admin') THEN
    RAISE EXCEPTION 'support_invalid_actor' USING ERRCODE='P0001'; END IF;
  IF p_actor='admin' AND (p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 1 AND 500)
    THEN RAISE EXCEPTION 'support_invalid_reason' USING ERRCODE='P0001'; END IF;
  UPDATE public.support_tickets SET status='closed',closed_at=now(),
    attachments_delete_at=now()+interval '30 days',closed_by=p_actor,
    close_reason=CASE WHEN p_actor='admin' THEN trim(p_reason) ELSE NULL END,
    revision=revision+1,updated_at=now()
   WHERE id=p_ticket_id AND revision=p_expected_revision AND status<>'closed'
   RETURNING * INTO v_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_conflict' USING ERRCODE='P0001'; END IF;
  -- A closed ticket cannot retain a private GitHub repository read grant.
  UPDATE public.support_permissions SET revoked_at=now() WHERE ticket_id=p_ticket_id
    AND kind='private_repo_read' AND revoked_at IS NULL;
  INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
    VALUES(p_ticket_id,'ticket.closed',p_actor);
  RETURN to_jsonb(v_ticket);
END $$;

CREATE OR REPLACE FUNCTION public.support_reopen_ticket(
  p_ticket_id uuid,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE;
BEGIN
  UPDATE public.support_tickets SET status='open',closed_at=NULL,attachments_delete_at=NULL,
    closed_by=NULL,close_reason=NULL,updated_at=now(),revision=revision+1
   WHERE id=p_ticket_id AND revision=p_expected_revision AND status='closed'
     AND closed_at IS NOT NULL AND closed_at<=now() AND closed_at+interval '7 days'>=now()
   RETURNING * INTO v_ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_conflict_or_expired' USING ERRCODE='P0001'; END IF;
  UPDATE public.support_permissions SET revoked_at=now() WHERE ticket_id=p_ticket_id
    AND kind='private_repo_read' AND revoked_at IS NULL;
  INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
    VALUES(p_ticket_id,'ticket.reopened','reporter');
  RETURN to_jsonb(v_ticket);
END $$;

REVOKE ALL ON FUNCTION public.support_take_rate(text,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_create_ticket(text,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_redeem_link(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_append_message(uuid,bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_close_ticket(uuid,bigint,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_reopen_ticket(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_take_rate(text,integer,integer),
  public.support_create_ticket(text,uuid,text,text,text,text),
  public.support_redeem_link(uuid,text),
  public.support_append_message(uuid,bigint,text),
  public.support_close_ticket(uuid,bigint,text,text),
  public.support_reopen_ticket(uuid,bigint) TO service_role;
COMMIT;
