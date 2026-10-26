-- Maple Dominion Consulting Inc. / Yere's adopted operational schedule.
-- These are purpose-based business limits, NOT universal statutory retention periods.
-- No workspace, account, reminder, attachment, contact, or reminder-fire deletion.
-- Grace period: no deletion before 2026-11-25 00:00 America/Toronto.
CREATE TABLE IF NOT EXISTS public.retention_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('notification_logs','support_tickets','admin_audit_logs','admin_sessions')),
  record_id uuid, -- NULL holds the whole category; useful during a documented incident.
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  review_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  released_at timestamptz
);
ALTER TABLE public.retention_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retention_holds FROM PUBLIC, anon, authenticated, service_role;
-- Hold administration is deliberately DB-owner-only, not a browser RPC or service endpoint.
CREATE INDEX IF NOT EXISTS retention_holds_active_idx ON public.retention_holds(category, record_id) WHERE released_at IS NULL;

-- Serialize hold administration with cleanup so a concurrent hold is not ignored.
CREATE OR REPLACE FUNCTION public.lock_retention_hold_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('yere-operational-retention'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_retention_hold_change() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS retention_hold_change_lock ON public.retention_holds;
CREATE TRIGGER retention_hold_change_lock BEFORE INSERT OR UPDATE OR DELETE ON public.retention_holds
FOR EACH ROW EXECUTE FUNCTION public.lock_retention_hold_change();
CREATE INDEX IF NOT EXISTS support_tickets_closed_updated_idx ON public.support_tickets(updated_at) WHERE status IN ('closed','resolved');
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_retention_idx ON public.admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  counts jsonb NOT NULL -- Aggregate counts only, no content/identifiers/tokens.
);
ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retention_runs FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.retention_is_held(p_category text, p_record_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.retention_holds h
    WHERE h.category = p_category AND h.released_at IS NULL
      AND (h.record_id IS NULL OR h.record_id = p_record_id));
$$;
REVOKE ALL ON FUNCTION public.retention_is_held(text,uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Keep audit history immutable for all ordinary/service-role writes. Only the DB-owner
-- retention job may delete an expired, unheld row, within its locked transaction.
CREATE OR REPLACE FUNCTION public.reject_admin_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'postgres'
    AND current_setting('yere.retention_job', true) = 'on'
    AND now() >= timestamptz '2026-11-25 05:00:00+00'
    AND OLD.created_at < now() - interval '24 months'
    AND NOT public.retention_is_held('admin_audit_logs', OLD.id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Admin audit logs are immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_operational_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  notification_count integer := 0; support_count integer := 0;
  audit_count integer := 0; session_count integer := 0; result jsonb;
BEGIN
  IF now() < timestamptz '2026-11-25 05:00:00+00' THEN
    RETURN jsonb_build_object('status','grace_period','starts_at','2026-11-25T05:00:00Z');
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('yere-operational-retention')) THEN
    RETURN jsonb_build_object('status','already_running');
  END IF;
  DELETE FROM public.notification_logs WHERE id IN (
    SELECT id FROM public.notification_logs n WHERE n.created_at < now() - interval '90 days'
      AND NOT public.retention_is_held('notification_logs',n.id)
    ORDER BY n.created_at LIMIT 5000 FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS notification_count = ROW_COUNT;
  DELETE FROM public.support_tickets WHERE id IN (
    SELECT id FROM public.support_tickets t WHERE t.status IN ('resolved','closed')
      AND t.updated_at < now() - interval '12 months'
      AND NOT public.retention_is_held('support_tickets',t.id)
    ORDER BY t.updated_at LIMIT 5000 FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS support_count = ROW_COUNT;
  PERFORM set_config('yere.retention_job','on',true);
  DELETE FROM public.admin_audit_logs WHERE id IN (
    SELECT id FROM public.admin_audit_logs a WHERE a.created_at < now() - interval '24 months'
      AND NOT public.retention_is_held('admin_audit_logs',a.id)
    ORDER BY a.created_at LIMIT 5000 FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS audit_count = ROW_COUNT;
  PERFORM set_config('yere.retention_job','off',true);
  DELETE FROM public.admin_sessions WHERE id IN (
    SELECT id FROM public.admin_sessions s
    WHERE greatest(s.expires_at,coalesce(s.revoked_at,s.expires_at)) < now() - interval '30 days'
      AND NOT public.retention_is_held('admin_sessions',s.id)
    ORDER BY s.expires_at LIMIT 5000 FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS session_count = ROW_COUNT;
  result := jsonb_build_object('status','completed','notification_logs',notification_count,
    'support_tickets',support_count,'admin_audit_logs',audit_count,'admin_sessions',session_count);
  INSERT INTO public.retention_runs(counts) VALUES (result);
  DELETE FROM public.retention_runs WHERE completed_at < now() - interval '90 days';
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_operational_records() FROM PUBLIC, anon, authenticated, service_role;
-- postgres/DB owner only. Browser/admin/service credentials cannot invoke a destructive RPC.
COMMENT ON FUNCTION public.purge_expired_operational_records() IS 'Hourly bounded retention; grace until 2026-11-25 Toronto; owner-only; legal holds preserved.';

-- pg_cron is already used by Yere's production notification scheduler. Do not alter it.
SELECT cron.schedule('yere-operational-retention','17 * * * *','select public.purge_expired_operational_records();');
