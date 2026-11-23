-- Run AFTER support-schema.sql and support-rpc.sql.
-- SECURITY INVOKER, server-only via service_role; client RLS stays deny-all.
BEGIN;

CREATE OR REPLACE FUNCTION public.support_begin_attachment(
 p_id uuid,p_ticket_id uuid,p_kind text,p_name text,p_content_type text,
 p_bytes integer,p_part_count integer,p_sha256 text,p_object_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ticket public.support_tickets%ROWTYPE; v_count integer;v_row public.support_attachments%ROWTYPE;
BEGIN
 SELECT * INTO v_ticket FROM public.support_tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_ticket.status='closed' THEN
   RAISE EXCEPTION 'support_ticket_closed_or_missing' USING ERRCODE='P0001'; END IF;
 IF p_kind NOT IN ('image','log') OR p_content_type <> (CASE WHEN p_kind='image' THEN 'image/png' ELSE 'text/plain' END)
  OR p_bytes<1 OR p_bytes>(CASE WHEN p_kind='image' THEN 5242880 ELSE 2097152 END)
  OR p_part_count<>(p_bytes+524287)/524288 OR p_part_count NOT BETWEEN 1 AND 16
  OR p_sha256 !~ '^[a-f0-9]{64}$' OR length(p_name) NOT BETWEEN 1 AND 120
  OR p_object_key<>('tickets/'||p_ticket_id::text||'/'||p_id::text||'/safe')
 THEN RAISE EXCEPTION 'support_invalid_attachment' USING ERRCODE='P0001'; END IF;
 SELECT count(*) INTO v_count FROM public.support_attachments
  WHERE ticket_id=p_ticket_id AND kind=p_kind AND state<>'deleted';
 IF v_count >= (CASE WHEN p_kind='image' THEN 3 ELSE 1 END) THEN
   RAISE EXCEPTION 'support_attachment_limit' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.support_attachments(id,ticket_id,kind,content_type,original_name,file_bytes,part_count,
     reviewed_at,original_object_key,original_sha256)
 VALUES(p_id,p_ticket_id,p_kind,p_content_type,p_name,p_bytes,p_part_count,now(),p_object_key,p_sha256)
 RETURNING * INTO v_row;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'attachment.started','reporter');
 RETURN jsonb_build_object('id',v_row.id,'ticketId',p_ticket_id,'state',v_row.state);
END $$;

CREATE OR REPLACE FUNCTION public.support_record_attachment_part(
 p_ticket_id uuid,p_id uuid,p_index integer,p_bytes integer,p_sha256 text,p_object_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_attachments%ROWTYPE;
BEGIN
 SELECT * INTO v_row FROM public.support_attachments WHERE id=p_id AND ticket_id=p_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_row.state<>'pending' OR
    NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=p_ticket_id AND status<>'closed') OR
    p_index<0 OR p_index>=v_row.part_count OR p_bytes NOT BETWEEN 1 AND 524288 OR
    p_sha256 !~ '^[a-f0-9]{64}$' OR
    p_object_key<>v_row.original_object_key||'/parts/'||p_index::text
 THEN RAISE EXCEPTION 'support_invalid_part' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.support_attachment_parts(attachment_id,part_index,byte_size,part_sha256,object_key)
 VALUES(p_id,p_index,p_bytes,p_sha256,p_object_key);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.support_finish_attachment(p_ticket_id uuid,p_id uuid,p_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_attachments%ROWTYPE;v_count integer;v_bytes bigint;
BEGIN
 SELECT * INTO v_row FROM public.support_attachments WHERE ticket_id=p_ticket_id AND id=p_id FOR UPDATE;
 IF NOT FOUND OR v_row.state<>'pending' OR v_row.original_sha256<>p_sha256 OR
    NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=p_ticket_id AND status<>'closed')
 THEN RAISE EXCEPTION 'support_invalid_completion' USING ERRCODE='P0001'; END IF;
 SELECT count(*),coalesce(sum(byte_size),0) INTO v_count,v_bytes FROM public.support_attachment_parts
  WHERE attachment_id=p_id;
 IF v_count<>v_row.part_count OR v_bytes<>v_row.file_bytes THEN
   RAISE EXCEPTION 'support_missing_parts' USING ERRCODE='P0001'; END IF;
 UPDATE public.support_attachments SET state='ready',
  sanitized_object_key=original_object_key,sanitized_sha256=original_sha256
 WHERE id=p_id RETURNING * INTO v_row;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'attachment.ready','reporter');
 RETURN jsonb_build_object('id',v_row.id,'state',v_row.state,'sha256',v_row.sanitized_sha256);
END $$;

CREATE OR REPLACE FUNCTION public.support_approve_attachment(p_ticket_id uuid,p_id uuid,p_sha256 text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_attachments%ROWTYPE;
BEGIN
 SELECT * INTO v_row FROM public.support_attachments WHERE id=p_id AND ticket_id=p_ticket_id FOR UPDATE;
 IF NOT FOUND OR v_row.state<>'ready' OR v_row.sanitized_sha256<>p_sha256 OR
   NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=p_ticket_id AND status<>'closed')
 THEN RAISE EXCEPTION 'support_cannot_approve' USING ERRCODE='P0001'; END IF;
 UPDATE public.support_permissions SET revoked_at=now()
  WHERE ticket_id=p_ticket_id AND kind='attachment_analysis'
    AND resource_id=p_id::text AND revoked_at IS NULL;
 INSERT INTO public.support_permissions(ticket_id,kind,resource_id,approved_redacted_sha256,
   processor,grantor_kind,approved,granted_at)
 VALUES(p_ticket_id,'attachment_analysis',p_id::text,p_sha256,'support-agent','reporter',true,now());
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'attachment.consent_granted','reporter');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.support_revoke_attachment(p_ticket_id uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.support_permissions SET revoked_at=now()
  WHERE ticket_id=p_ticket_id AND kind='attachment_analysis'
    AND resource_id=p_id::text AND revoked_at IS NULL;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'attachment.consent_revoked','reporter');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.support_mark_attachment_deleted(p_ticket_id uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE id=p_ticket_id AND status='closed'
    AND attachments_delete_at<=now()) THEN
    RAISE EXCEPTION 'support_cleanup_not_due' USING ERRCODE='P0001'; END IF;
 UPDATE public.support_attachments SET state='deleted',deleted_at=now(),
  sanitized_object_key=NULL
 WHERE id=p_id AND ticket_id=p_ticket_id AND state<>'deleted';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.support_permissions SET revoked_at=now()
  WHERE ticket_id=p_ticket_id AND resource_id=p_id::text AND revoked_at IS NULL;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'attachment.deleted','system');
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.support_begin_attachment(uuid,uuid,text,text,text,integer,integer,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_record_attachment_part(uuid,uuid,integer,integer,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_finish_attachment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_approve_attachment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_revoke_attachment(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.support_mark_attachment_deleted(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_begin_attachment(uuid,uuid,text,text,text,integer,integer,text,text),
 public.support_record_attachment_part(uuid,uuid,integer,integer,text,text),
 public.support_finish_attachment(uuid,uuid,text),
 public.support_approve_attachment(uuid,uuid,text),
 public.support_revoke_attachment(uuid,uuid),
 public.support_mark_attachment_deleted(uuid,uuid) TO service_role;
COMMIT;