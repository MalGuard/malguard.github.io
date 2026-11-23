-- Owner-only step-up authentication and expert replies for MalGuard Support.
-- Apply only after support-schema.sql and support-rpc.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.support_admin_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_email text NOT NULL CHECK (owner_email=lower(owner_email) AND length(owner_email) BETWEEN 3 AND 254),
 code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_admin_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_admin_challenges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.support_admin_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.support_issue_admin_challenge(
 p_email text,p_code_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_id uuid;
BEGIN
 IF p_email IS NULL OR p_email<>lower(p_email) OR length(p_email) NOT BETWEEN 3 AND 254
   OR p_code_hash !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION 'support_invalid_admin_request' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.support_admin_challenges(owner_email,code_hash,expires_at)
 VALUES(p_email,p_code_hash,now()+interval '10 minutes') RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.support_redeem_admin_challenge(
 p_id uuid,p_email text,p_code_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_ok boolean;
BEGIN
 IF p_email IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
 UPDATE public.support_admin_challenges SET attempts=attempts+1,
  consumed_at=CASE WHEN code_hash=p_code_hash THEN now() ELSE NULL END
 WHERE id=p_id AND owner_email=p_email AND consumed_at IS NULL AND attempts<5 AND expires_at>now()
 RETURNING (code_hash=p_code_hash) INTO v_ok;
 RETURN coalesce(v_ok,false);
END $$;

CREATE OR REPLACE FUNCTION public.support_append_expert_message(
 p_ticket_id uuid,p_expected_revision bigint,p_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_row public.support_tickets%ROWTYPE;v_id uuid;
BEGIN
 IF p_content IS NULL OR length(trim(p_content)) NOT BETWEEN 1 AND 6000
 THEN RAISE EXCEPTION 'support_invalid_reply' USING ERRCODE='P0001'; END IF;
 UPDATE public.support_tickets SET revision=revision+1,updated_at=now()
 WHERE id=p_ticket_id AND revision=p_expected_revision AND status<>'closed'
 RETURNING * INTO v_row;
 IF NOT FOUND THEN RAISE EXCEPTION 'support_conflict' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.support_messages(ticket_id,author_kind,content)
 VALUES(p_ticket_id,'expert',trim(p_content)) RETURNING id INTO v_id;
 INSERT INTO public.support_audit_events(ticket_id,event_kind,actor_kind)
 VALUES(p_ticket_id,'expert.responded','admin');
 RETURN jsonb_build_object('messageId',v_id,'revision',v_row.revision);
END $$;

REVOKE ALL ON FUNCTION public.support_issue_admin_challenge(text,text),
 public.support_redeem_admin_challenge(uuid,text,text),
 public.support_append_expert_message(uuid,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_issue_admin_challenge(text,text),
 public.support_redeem_admin_challenge(uuid,text,text),
 public.support_append_expert_message(uuid,bigint,text)
 TO service_role;
COMMIT;