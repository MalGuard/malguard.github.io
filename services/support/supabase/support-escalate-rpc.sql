-- Atomic user-requested AI -> human support escalation. Server-only.
BEGIN;
CREATE OR REPLACE FUNCTION public.support_escalate_ticket(
 p_ticket_id uuid,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_tickets%ROWTYPE;
BEGIN
 UPDATE public.support_tickets SET routing='expert',revision=revision+1,updated_at=now()
  WHERE id=p_ticket_id AND revision=p_expected_revision AND status<>'closed' AND routing='agent'
  RETURNING * INTO v_row;
 IF NOT FOUND THEN RAISE EXCEPTION 'support_escalation_conflict' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.support_messages(ticket_id,author_kind,content)
  VALUES(p_ticket_id,'system','The reporter requested human support. A delivery attempt to the support inbox may follow.');
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
  VALUES(p_ticket_id,'ticket.human_requested','reporter');
 RETURN to_jsonb(v_row);
END $$;
REVOKE ALL ON FUNCTION public.support_escalate_ticket(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_escalate_ticket(uuid,bigint) TO service_role;
COMMIT;