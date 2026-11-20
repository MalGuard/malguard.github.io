-- Verify consent-gated agent response storage against disposable Postgres.
DO $$ BEGIN
 IF has_function_privilege('anon','public.support_append_agent_message(uuid,bigint,text)','EXECUTE') THEN
  RAISE EXCEPTION 'browser can write AI messages'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE v_id uuid;v_other uuid;v_reply jsonb;v_rejected boolean:=false;
BEGIN
 v_id:=public.support_create_ticket('agent@example.test',NULL,'bug','agent','UI freeze','App stays blank');
 v_reply:=public.support_append_agent_message(v_id,0,'Try a harmless refresh and report the exact version.');
 IF (v_reply->>'revision')::int<>1 OR NOT EXISTS(
   SELECT 1 FROM public.support_messages WHERE ticket_id=v_id AND author_kind='support-agent'
 ) THEN RAISE EXCEPTION 'AI response was not persisted atomically'; END IF;
 v_other:=public.support_create_ticket('human@example.test',NULL,'bug','expert','UI freeze','App stays blank');
 BEGIN
  PERFORM public.support_append_agent_message(v_other,0,'No reply without route consent');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected:=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'agent wrote to human-only ticket'; END IF;
END $$;
RESET ROLE;