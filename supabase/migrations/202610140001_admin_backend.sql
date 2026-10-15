-- Secure administrative foundation for Yere. Admins are provisioned manually; public signup never grants a role.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','admin','support','read_only')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- A session is bound to the hash of the verified Supabase access token. The raw token is never stored here.
create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  ip text check (ip is null or char_length(ip) <= 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  revoked_at timestamptz
);
create index if not exists admin_sessions_user_active_idx on public.admin_sessions(user_id, expires_at desc) where revoked_at is null;

-- Immutable trail. target_id is text so logs survive deletion of the target account/row.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Keep the actor UUID as immutable historical data; no FK means account deletion cannot rewrite this row.
  admin_id uuid,
  action text not null check (char_length(action) between 1 and 120),
  target_table text check (target_table is null or char_length(target_table) <= 80),
  target_id text check (target_id is null or char_length(target_id) <= 160),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip text check (ip is null or char_length(ip) <= 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs(admin_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs(target_table, target_id, created_at desc);

create table if not exists public.app_settings (
  key text primary key check (char_length(key) between 1 and 100),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  enabled boolean not null default false,
  description text not null default '' check (char_length(description) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  audience text not null default 'all' check (audience in ('all','selected')),
  audience_ids uuid[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (audience <> 'selected' or cardinality(audience_ids) > 0)
);
create index if not exists announcements_active_window_idx on public.announcements(starts_at, ends_at) where active;

create table if not exists public.blocklist (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  reason text not null default '' check (char_length(reason) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null),
  check (email is null or (email = lower(trim(email)) and char_length(email) <= 320)),
  check (phone is null or char_length(phone) <= 32)
);
create unique index if not exists blocklist_email_lower_idx on public.blocklist(lower(email)) where email is not null;
create unique index if not exists blocklist_phone_idx on public.blocklist(phone) where phone is not null;

create table if not exists public.maintenance_mode (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  message text not null default 'Yere is temporarily unavailable. Please try again soon.' check (char_length(message) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.maintenance_mode(id, enabled) values (1, false) on conflict (id) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_response text check (admin_response is null or char_length(admin_response) <= 10000),
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_status_created_idx on public.support_tickets(status, created_at desc);
create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id, created_at desc);

-- One row per delivery attempt; reminder_fires remains the idempotency ledger.
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_fire_id uuid references public.reminder_fires(id) on delete set null,
  reminder_id uuid references public.reminders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('push','email','sms')),
  status text not null check (status in ('queued','sent','partial','failed','retried','skipped')),
  attempt integer not null default 1 check (attempt > 0),
  provider_reference text check (provider_reference is null or char_length(provider_reference) <= 300),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists notification_logs_created_idx on public.notification_logs(created_at desc);
create index if not exists notification_logs_user_idx on public.notification_logs(user_id, created_at desc);
create index if not exists notification_logs_fire_idx on public.notification_logs(reminder_fire_id, created_at desc);

-- Keep session tokens and admin records server-only. Browser admin reads must go through
-- session-validated Edge Functions so reminder/user access can be audited and require reasons.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['admin_users','admin_sessions','admin_audit_logs','app_settings','feature_flags','announcements','blocklist','maintenance_mode','support_tickets','notification_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;

REVOKE ALL ON public.admin_users, public.admin_sessions, public.admin_audit_logs,
  public.app_settings, public.feature_flags, public.announcements, public.blocklist,
  public.maintenance_mode, public.support_tickets, public.notification_logs FROM anon, authenticated;

-- Ordinary signed-in users may inspect only their own admin-account marker and support tickets.
GRANT SELECT ON public.admin_users TO authenticated;
DROP POLICY IF EXISTS admin_users_read_self_or_super ON public.admin_users;
DROP POLICY IF EXISTS admin_users_read_self ON public.admin_users;
CREATE POLICY admin_users_read_self ON public.admin_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

GRANT SELECT ON public.feature_flags, public.announcements, public.maintenance_mode TO anon, authenticated;
DROP POLICY IF EXISTS feature_flags_read_enabled ON public.feature_flags;
CREATE POLICY feature_flags_read_enabled ON public.feature_flags FOR SELECT TO anon, authenticated
USING (enabled = true);

DROP POLICY IF EXISTS announcements_read_active ON public.announcements;
CREATE POLICY announcements_read_active ON public.announcements FOR SELECT TO anon, authenticated
USING (
  active = true AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
  AND (audience = 'all' OR (audience = 'selected' AND auth.uid() = ANY(audience_ids)))
);

DROP POLICY IF EXISTS maintenance_mode_read ON public.maintenance_mode;
CREATE POLICY maintenance_mode_read ON public.maintenance_mode FOR SELECT TO anon, authenticated
USING (enabled = true);

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
DROP POLICY IF EXISTS support_tickets_owner_read_or_admin ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_owner_select ON public.support_tickets;
CREATE POLICY support_tickets_owner_select ON public.support_tickets FOR SELECT TO authenticated
USING (user_id = auth.uid());
DROP POLICY IF EXISTS support_tickets_owner_insert ON public.support_tickets;
CREATE POLICY support_tickets_owner_insert ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'open' AND admin_response IS NULL AND responded_by IS NULL);

-- Remove any earlier broad admin policies. The service-role Edge Functions below
-- are the only cross-account read path; they validate role, session, MFA, view reason, and audit.
DROP POLICY IF EXISTS admin_audit_logs_read_admin ON public.admin_audit_logs;
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
DROP POLICY IF EXISTS user_lists_admin_read ON public.user_lists;
DROP POLICY IF EXISTS reminders_admin_read ON public.reminders;
DROP POLICY IF EXISTS reminder_attachments_admin_read ON public.reminder_attachments;
DROP POLICY IF EXISTS contacts_admin_read ON public.contacts;
DROP POLICY IF EXISTS contact_invites_admin_read ON public.contact_invites;
DROP POLICY IF EXISTS reminder_fires_admin_read ON public.reminder_fires;
DROP POLICY IF EXISTS push_subscriptions_admin_read ON public.push_subscriptions;
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
DROP POLICY IF EXISTS notification_logs_admin_read ON public.notification_logs;

-- Application clients retain their owner-scoped access. These grants do not add cross-user RLS policies.
GRANT SELECT ON public.profiles, public.user_lists, public.reminders,
  public.reminder_attachments, public.contacts, public.audit_logs TO authenticated;
REVOKE ALL ON public.contact_invites, public.reminder_fires, public.notification_logs FROM anon, authenticated;
REVOKE SELECT ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT (id, owner_id, expiration_time, user_agent, created_at, updated_at)
  ON public.push_subscriptions TO authenticated;

-- Do not allow browser roles to mutate the immutable admin audit trail. Service-role functions append it.
CREATE OR REPLACE FUNCTION public.reject_admin_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Admin audit logs are immutable';
END;
$$;
DROP TRIGGER IF EXISTS admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_admin_audit_mutation();

-- Revoke default broad grants on sensitive admin tables; service_role retains server access.
REVOKE ALL ON public.admin_sessions, public.admin_audit_logs, public.blocklist, public.notification_logs FROM anon;
REVOKE UPDATE, DELETE ON public.admin_audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_users, public.admin_sessions, public.app_settings, public.blocklist, public.feature_flags, public.announcements, public.maintenance_mode, public.support_tickets, public.notification_logs FROM anon, authenticated;

-- Users may open/read their own support cases; they cannot set admin response/status fields.
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT INSERT (user_id, subject, body) ON public.support_tickets TO authenticated;

-- Preserve at least one active super_admin, even if an account is deleted or changed outside the UI.
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE remaining_super_admins integer;
DECLARE removes_super_admin boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    removes_super_admin := OLD.role = 'super_admin' AND OLD.is_active;
  ELSE
    removes_super_admin := OLD.role = 'super_admin' AND OLD.is_active
      AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active);
  END IF;

  IF removes_super_admin THEN
    PERFORM pg_advisory_xact_lock(742001, 1);
    SELECT count(*) INTO remaining_super_admins
    FROM public.admin_users WHERE role = 'super_admin' AND is_active = true;
    IF remaining_super_admins <= 1 THEN
      RAISE EXCEPTION 'The last active super_admin cannot be removed or deactivated';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_last_super_admin ON public.admin_users;
CREATE TRIGGER protect_last_super_admin BEFORE UPDATE OF role, is_active OR DELETE
ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.protect_last_super_admin();

-- Role changes and their audit event are one transaction; only service-role Edge Functions can call this.
CREATE OR REPLACE FUNCTION public.set_admin_role(
  p_actor uuid,
  p_user_id uuid,
  p_role text,
  p_is_active boolean,
  p_reason text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE old_role text;
DECLARE old_is_active boolean;
DECLARE has_existing boolean;
DECLARE active_super_admins integer;
BEGIN
  IF p_actor IS NULL OR p_user_id IS NULL THEN RAISE EXCEPTION 'Actor and target are required'; END IF;
  IF p_role NOT IN ('super_admin','admin','support','read_only') THEN RAISE EXCEPTION 'Invalid admin role'; END IF;
  IF p_is_active IS NULL THEN RAISE EXCEPTION 'Active state is required'; END IF;
  IF char_length(trim(coalesce(p_reason,''))) < 8 OR char_length(p_reason) > 500 THEN RAISE EXCEPTION 'A role-change reason is required'; END IF;
  IF p_ip IS NOT NULL AND char_length(p_ip) > 128 THEN RAISE EXCEPTION 'IP value is too long'; END IF;
  IF p_user_agent IS NOT NULL AND char_length(p_user_agent) > 512 THEN RAISE EXCEPTION 'User agent is too long'; END IF;

  PERFORM pg_advisory_xact_lock(742001, 1);
  SELECT role, is_active INTO old_role, old_is_active
  FROM public.admin_users WHERE user_id = p_user_id FOR UPDATE;
  has_existing := FOUND;

  SELECT count(*) INTO active_super_admins
  FROM public.admin_users WHERE role = 'super_admin' AND is_active = true;
  IF has_existing AND old_role = 'super_admin' AND old_is_active
    AND (p_role <> 'super_admin' OR NOT p_is_active) AND active_super_admins <= 1 THEN
    RAISE EXCEPTION 'The last active super_admin cannot be removed or deactivated';
  END IF;

  INSERT INTO public.admin_users(user_id, role, is_active, created_by)
  VALUES (p_user_id, p_role, p_is_active, p_actor)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.admin_audit_logs(admin_id, action, target_table, target_id, metadata, ip, user_agent)
  VALUES (p_actor, 'admin_role_updated', 'admin_users', p_user_id::text,
    jsonb_build_object('role', p_role, 'isActive', p_is_active, 'reason', trim(p_reason)), p_ip, p_user_agent);
END;
$$;
REVOKE ALL ON FUNCTION public.set_admin_role(uuid, uuid, text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role(uuid, uuid, text, boolean, text, text, text) TO service_role;

-- Supabase Edge Functions use this server-only role for audited admin reads and writes.
GRANT ALL ON public.admin_users, public.admin_sessions,
  public.app_settings, public.feature_flags, public.announcements, public.blocklist,
  public.maintenance_mode, public.support_tickets, public.notification_logs TO service_role;
GRANT SELECT, INSERT ON public.admin_audit_logs TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_logs FROM PUBLIC, anon, authenticated, service_role;
