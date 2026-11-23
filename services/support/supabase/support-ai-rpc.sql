-- Service-role-only atomic persistence for consented support-model responses.
BEGIN;
CREATE OR REPLACE FUNCTION public.support_append_agent_message(
 p_ticket_id uuid,p_expected_revision bigint,p_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_tickets%ROWTYPE; v_id uuid;
BEGIN
 IF p_content IS NULL OR length(trim(p_content))<1 OR length(p_content)>6000 THEN
  RAISE EXCEPTION 'support_invalid_ai_response' USING ERRCODE='P0001';
 END IF;
 UPDATE public.support_tickets SET revision=revision+1,updated_at=now()
  WHERE id=p_ticket_id AND revision=p_expected_revision AND status<>'closed'
   AND routing='agent' AND kind='bug'
  RETURNING * INTO v_row;
 IF NOT FOUND THEN RAISE EXCEPTION 'support_agent_conflict' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.support_messages(ticket_id,author_kind,content)
  VALUES(p_ticket_id,'support-agent',p_content) RETURNING id INTO v_id;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
  VALUES(p_ticket_id,'agent.responded','agent');
 RETURN jsonb_build_object('messageId',v_id,'revision',v_row.revision);
END $$;
REVOKE ALL ON FUNCTION public.support_append_agent_message(uuid,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_append_agent_message(uuid,bigint,text)
 TO service_role;
COMMIT;