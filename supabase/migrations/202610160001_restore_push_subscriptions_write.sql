-- Restore authenticated write access to push_subscriptions
-- that was unintentionally removed by 202610140001_admin_backend.sql.
--
-- That migration did:
--   REVOKE SELECT ON public.push_subscriptions FROM anon, authenticated;
--   GRANT SELECT (id, owner_id, expiration_time, user_agent, created_at, updated_at)
--     ON public.push_subscriptions TO authenticated;
-- which left authenticated with a column-level SELECT on five columns and
-- no INSERT / UPDATE / DELETE. The existing RLS policy
--   push_subscriptions_owner_all FOR ALL TO authenticated
--   USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())
-- still correctly scopes rows to their owner, but without a table GRANT the
-- PostgREST insert is rejected with 42501 "permission denied for table
-- push_subscriptions" — exactly what the phone shows after a successful
-- pushManager.subscribe().
--
-- This migration grants the table privileges the client actually needs.
-- Anonymous callers keep no access; RLS still enforces owner isolation.

-- Ensure the table is still RLS-protected (idempotent).
alter table public.push_subscriptions enable row level security;

-- Anonymous (not signed in) may not read or write push subscriptions at all.
revoke all on public.push_subscriptions from anon;

-- The browser, as the signed-in owner, must be able to create, read, update
-- and delete its own subscriptions. The owner-scoped RLS policy above still
-- prevents any cross-user access.
grant select, insert, update, delete on public.push_subscriptions to authenticated;
