-- Verify private user-to-human escalation in a disposable Postgres DB.
DO $$ BEGIN
 IF has_function_privilege('anon','public.support_escalate_ticket(uuid,bigint)','EXECUTE') OR
    has_function_privilege('authenticated','public.support_escalate_ticket(uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'untrusted roles can escalate directly'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE v_id uuid;v_result jsonb;v_rejected boolean:=false;v_rev bigint;
BEGIN
 v_id:=public.support_create_ticket('handoff@example.test',NULL,'bug','agent','Scanner is frozen','Frozen on opening');
 v_result:=public.support_escalate_ticket(v_id,0);
 IF v_result->>'routing'<>'expert' OR (v_result->>'revision')::bigint<>1
 THEN RAISE EXCEPTION 'human handoff not atomic'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.support_messages WHERE ticket_id=v_id
  AND author_kind='system' AND content LIKE '%human support%')
 THEN RAISE EXCEPTION 'handoff not recorded in conversation'; END IF;
 BEGIN
  PERFORM public.support_escalate_ticket(v_id,0);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'duplicate handoff accepted'; END IF;
 v_rejected=false;
 BEGIN PERFORM public.support_append_agent_message(v_id,1,'I should be blocked now');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'AI continued to message human-only ticket'; END IF;
 SELECT revision INTO v_rev FROM public.support_tickets WHERE id=v_id;
 v_result:=public.support_append_expert_message(v_id,v_rev,'Please provide the browser version');
 IF (v_result->>'revision')::bigint<>v_rev+1 THEN
  RAISE EXCEPTION 'expert response revision not incremented'; END IF;
END $$;
RESET ROLE;
