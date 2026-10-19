-- Admin invitations must support existing Auth accounts without creating duplicates.
-- These lookups and grants are service-role only; browser clients cannot enumerate
-- Auth emails or grant themselves administrative access.
CREATE OR REPLACE FUNCTION public.lookup_admin_invite_target(p_email text)
RETURNS TABLE (user_id uuid, email_confirmed boolean, is_banned boolean, admin_role text, admin_active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT u.id, u.email_confirmed_at IS NOT NULL,
    coalesce(u.banned_until > now(), false), a.role, a.is_active
  FROM auth.users u
  LEFT JOIN public.admin_users a ON a.user_id = u.id
  WHERE lower(u.email) = lower(trim(p_email)) AND u.deleted_at IS NULL
  LIMIT 2;
$$;
REVOKE ALL ON FUNCTION public.lookup_admin_invite_target(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_admin_invite_target(text) TO service_role;

-- Use the same lock as set_admin_role so simultaneous invitations and role
-- changes cannot overwrite an existing administrator (including a super admin).
CREATE OR REPLACE FUNCTION public.grant_admin_invitation(
  p_actor uuid,
  p_user_id uuid,
  p_role text,
  p_reason text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(742001, 1);
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_actor AND role = 'super_admin' AND is_active) THEN
    RAISE EXCEPTION 'An active super admin is required';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'support', 'read_only') THEN
    RAISE EXCEPTION 'Invalid invitation role';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'admin_invite_target_already_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until <= now())) THEN
    RAISE EXCEPTION 'admin_invite_target_unavailable';
  END IF;
  -- Preserve the existing atomic role grant and audited reason.
  PERFORM public.set_admin_role(p_actor, p_user_id, p_role, true, p_reason, p_ip, p_user_agent);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_admin_invitation(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_invitation(uuid, uuid, text, text, text, text) TO service_role;
