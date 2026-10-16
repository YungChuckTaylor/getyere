-- Native iOS/Android push targets alongside existing Web Push subscriptions.
-- Apply after 202610120001_yere_core.sql.

alter table public.push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.push_subscriptions
  add column if not exists device_token text,
  add column if not exists platform text,
  add column if not exists provider text;

update public.push_subscriptions
set platform = coalesce(platform, 'web'),
    provider = coalesce(provider, 'webpush')
where platform is null or provider is null;

alter table public.push_subscriptions
  alter column platform set default 'web',
  alter column platform set not null,
  alter column provider set default 'webpush',
  alter column provider set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_platform_check') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_platform_check
      check (platform in ('web', 'android', 'ios'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_provider_check') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_provider_check
      check (provider in ('webpush', 'fcm', 'apns'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_target_check') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_target_check check (
        (provider = 'webpush' and platform = 'web' and endpoint is not null and p256dh is not null and auth is not null and device_token is null)
        or
        (provider = 'fcm' and platform = 'android' and device_token is not null and endpoint is null and p256dh is null and auth is null)
        or
        (provider = 'apns' and platform = 'ios' and device_token is not null and endpoint is null and p256dh is null and auth is null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_device_token_key') then
    alter table public.push_subscriptions
      add constraint push_subscriptions_device_token_key unique (device_token);
  end if;
end;
$$;

alter table public.push_subscriptions
  add constraint push_subscriptions_device_token_length
  check (device_token is null or char_length(device_token) between 16 and 4096) not valid;

alter table public.push_subscriptions
  validate constraint push_subscriptions_device_token_length;

create index if not exists push_subscriptions_native_owner_idx
  on public.push_subscriptions(owner_id, platform)
  where device_token is not null;

-- Device tokens may survive an account switch. Register atomically through a
-- security-definer function so a token can never continue delivering one user's
-- reminder after the same device signs in as another user.
create or replace function public.register_native_push_token(
  p_device_token text,
  p_platform text,
  p_provider text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  subscription_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(coalesce(p_device_token, '')) not between 16 and 4096 then raise exception 'Invalid device token'; end if;
  if not ((p_platform = 'android' and p_provider = 'fcm') or (p_platform = 'ios' and p_provider = 'apns')) then
    raise exception 'Invalid native push provider';
  end if;

  delete from public.push_subscriptions where device_token = p_device_token;
  insert into public.push_subscriptions(owner_id, device_token, platform, provider, user_agent, updated_at)
  values(auth.uid(), p_device_token, p_platform, p_provider, left(p_user_agent, 250), now())
  returning id into subscription_id;
  return subscription_id;
end;
$$;

revoke all on function public.register_native_push_token(text,text,text,text) from public, anon;
grant execute on function public.register_native_push_token(text,text,text,text) to authenticated;

-- Account deletion cleanup for cross-account trusted-contact attribution. This
-- function is service-only and is called immediately before auth.admin.deleteUser.
create or replace function public.detach_deleted_yere_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reminders
  set created_by = owner_id, from_contact_id = null, updated_at = now()
  where created_by = p_user_id and owner_id <> p_user_id;

  delete from public.contacts where contact_user_id = p_user_id;
end;
$$;

revoke all on function public.detach_deleted_yere_user(uuid) from public, anon, authenticated;
grant execute on function public.detach_deleted_yere_user(uuid) to service_role;
