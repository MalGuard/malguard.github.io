-- Disposable PostgreSQL smoke test: owner OTP and expert messages, never production.
DO $$
BEGIN
 IF has_table_privilege('anon','public.support_admin_challenges','SELECT')
   OR has_function_privilege('anon','public.support_redeem_admin_challenge(uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'admin challenge leaked to client roles'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE v_ticket uuid;v_id uuid;v_hash text:=repeat('a',64);v_wrong text:=repeat('b',64);
 v_message jsonb;v_close jsonb;
BEGIN
 v_ticket:=public.support_create_ticket('case@example.test',NULL,'bug','expert','Issue','Error report');
 v_id:=public.support_issue_admin_challenge('owner@example.test',v_hash);
 IF public.support_redeem_admin_challenge(v_id,'owner@example.test',v_wrong) THEN
   RAISE EXCEPTION 'incorrect code accepted';END IF;
 IF public.support_redeem_admin_challenge(v_id,'other@example.test',v_hash) THEN
   RAISE EXCEPTION 'wrong identity accepted';END IF;
 IF NOT public.support_redeem_admin_challenge(v_id,'owner@example.test',v_hash) THEN
   RAISE EXCEPTION 'correct code rejected';END IF;
 IF public.support_redeem_admin_challenge(v_id,'owner@example.test',v_hash) THEN
   RAISE EXCEPTION 'replayed owner code';END IF;
 v_message:=public.support_append_expert_message(v_ticket,0,'Please confirm your OS version.');
 IF (v_message->>'revision')::bigint<>1 THEN RAISE EXCEPTION 'expert reply lost';END IF;
 v_close:=public.support_close_ticket(v_ticket,1,'admin','Issue resolved with verification');
 IF v_close->>'closed_by'<>'admin' OR v_close->>'status'<>'closed' THEN
   RAISE EXCEPTION 'admin closure was not persisted';END IF;
END $$;
RESET ROLE;