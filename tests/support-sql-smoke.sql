-- CI-only integration assertions against disposable PostgreSQL.
-- Run after the support schema + support-rpc scripts and test-only roles.
DO $$
BEGIN
  IF has_table_privilege('anon','public.support_tickets','SELECT') OR
     has_table_privilege('authenticated','public.support_tickets','SELECT') OR
     has_function_privilege('anon','public.support_redeem_link(uuid,text)','EXECUTE') OR
     has_function_privilege('authenticated','public.support_create_ticket(text,uuid,text,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'support database grants are too permissive'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.support_tickets'::regclass) OR
     NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.support_access_links'::regclass)
  THEN RAISE EXCEPTION 'RLS must be enabled'; END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE
  v_id uuid;
  v_revision bigint;
  v_row jsonb;
  v_token text:=repeat('a',64);
  v_rate text:=repeat('f',64);
  v_closed_at timestamptz;
  v_delete_at timestamptz;
  v_revoked_at timestamptz;
BEGIN
  v_id:=public.support_create_ticket('one@example.test',NULL,'bug','expert','Scanner error','Cannot open scan page');
  IF NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=v_id AND routing='expert') THEN
    RAISE EXCEPTION 'human routing choice was lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.support_messages
    WHERE ticket_id=v_id AND content='Cannot open scan page') THEN
    RAISE EXCEPTION 'ticket message is not created atomically';
  END IF;
  IF NOT public.support_take_rate(v_rate,1,3600) OR public.support_take_rate(v_rate,1,3600) THEN
    RAISE EXCEPTION 'rate limit is not atomic';
  END IF;
  INSERT INTO public.support_access_links(ticket_id,email,token_hash,expires_at)
  VALUES(v_id,'one@example.test',v_token,now()+interval '15 minutes');
  v_row:=public.support_redeem_link(v_id,v_token);
  IF v_row->>'ticketId' <> v_id::text THEN RAISE EXCEPTION 'link redemption failed'; END IF;
  IF public.support_redeem_link(v_id,v_token) IS NOT NULL THEN
    RAISE EXCEPTION 'email link replay should be rejected';
  END IF;

  SELECT revision INTO v_revision FROM public.support_tickets WHERE id=v_id;
  v_row:=public.support_append_message(v_id,v_revision,'follow up');
  IF (v_row->>'revision')::bigint<>v_revision+1 THEN
    RAISE EXCEPTION 'revision not incremented for message';
  END IF;

  INSERT INTO public.support_permissions(ticket_id,kind,resource_id,grantor_kind,approved,granted_at)
  VALUES(v_id,'private_repo_read','MalGuard/private','admin',true,now());
  v_row:=public.support_close_ticket(v_id,v_revision+1,'reporter',NULL);
  IF v_row->>'status'<>'closed' THEN RAISE EXCEPTION 'close failed'; END IF;
  SELECT closed_at,attachments_delete_at INTO v_closed_at,v_delete_at
    FROM public.support_tickets WHERE id=v_id;
  IF v_delete_at<>v_closed_at+interval '30 days' THEN
    RAISE EXCEPTION 'attachment retention deadline incorrect';
  END IF;
  SELECT revoked_at INTO v_revoked_at FROM public.support_permissions
  WHERE ticket_id=v_id AND kind='private_repo_read';
  IF v_revoked_at IS NULL THEN RAISE EXCEPTION 'private repository grant remained active'; END IF;
  BEGIN
    PERFORM public.support_append_message(v_id,v_revision+2,'cannot write');
    RAISE EXCEPTION 'closed ticket accepted new message' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  v_row:=public.support_reopen_ticket(v_id,v_revision+2);
  IF v_row->>'status'<>'open' THEN RAISE EXCEPTION 'reopening failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.support_tickets
    WHERE id=v_id AND (closed_at IS NOT NULL OR attachments_delete_at IS NOT NULL))
  THEN RAISE EXCEPTION 'reopening did not cancel attachment deletion'; END IF;
END $$;
RESET ROLE;
