-- Disposable PostgreSQL verification for private attachment lifecycle.
DO $$
BEGIN
 IF has_table_privilege('anon','public.support_attachment_parts','SELECT') OR
    has_function_privilege('anon','public.support_begin_attachment(uuid,uuid,text,text,text,integer,integer,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'browser role can access private attachments'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE
 v_id uuid;v_attachment uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_sha text:=repeat('c',64);v_part text:=repeat('d',64);
 v_path text;v_response jsonb;v_raised boolean;
BEGIN
 v_id:=public.support_create_ticket('attachment@example.test',NULL,'bug','agent','Upload check','The scanner failed');
 v_path:='tickets/'||v_id::text||'/'||v_attachment::text||'/safe';
 v_response:=public.support_begin_attachment(v_attachment,v_id,'log','issue.log','text/plain',1000,1,v_sha,v_path);
 IF v_response->>'id'<>v_attachment::text THEN RAISE EXCEPTION 'begin upload failed'; END IF;
 IF NOT public.support_record_attachment_part(v_id,v_attachment,0,1000,v_part,v_path||'/parts/0') THEN
  RAISE EXCEPTION 'part write failed';END IF;
 v_response:=public.support_finish_attachment(v_id,v_attachment,v_sha);
 IF v_response->>'state'<>'ready' OR v_response->>'sha256'<>v_sha THEN
  RAISE EXCEPTION 'completion did not record sanitized sha';END IF;
 IF NOT public.support_approve_attachment(v_id,v_attachment,v_sha) THEN
  RAISE EXCEPTION 'consent not recorded';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_permissions WHERE ticket_id=v_id
  AND kind='attachment_analysis' AND approved AND revoked_at IS NULL) THEN
  RAISE EXCEPTION 'consent missing';END IF;
 IF NOT public.support_revoke_attachment(v_id,v_attachment) THEN
  RAISE EXCEPTION 'consent revocation failed';END IF;
 IF EXISTS(SELECT 1 FROM public.support_permissions WHERE ticket_id=v_id
  AND kind='attachment_analysis' AND revoked_at IS NULL) THEN
  RAISE EXCEPTION 'consent still active';END IF;

 PERFORM public.support_close_ticket(v_id,0,'reporter',NULL);
 v_raised:=false;
 BEGIN PERFORM public.support_begin_attachment(gen_random_uuid(),v_id,'log','later.log','text/plain',1,1,v_sha,'wrong');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_raised:=true; END;
 IF NOT v_raised THEN RAISE EXCEPTION 'upload accepted on closed ticket';END IF;
 v_raised:=false;
 BEGIN PERFORM public.support_mark_attachment_deleted(v_id,v_attachment);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_raised:=true; END;
 IF NOT v_raised THEN RAISE EXCEPTION 'attachment deleted before deadline';END IF;
 UPDATE public.support_tickets SET closed_at=now()-interval '31 days',
  attachments_delete_at=now()-interval '1 day' WHERE id=v_id;
 IF NOT public.support_mark_attachment_deleted(v_id,v_attachment) THEN
  RAISE EXCEPTION 'cleanup mark failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_attachments WHERE id=v_attachment AND
   state='deleted' AND deleted_at IS NOT NULL) THEN
  RAISE EXCEPTION 'attachment cleanup not recorded';END IF;
END $$;
RESET ROLE;
