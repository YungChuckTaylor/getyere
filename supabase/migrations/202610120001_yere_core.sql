-- Yere core schema. Apply with `supabase db push` or the Supabase SQL editor.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Yere member' check (char_length(display_name) between 1 and 80),
  timezone text not null default 'Africa/Lagos',
  theme text not null default 'dark' check (theme in ('dark','light')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_yere_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  display_name text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), nullif(split_part(coalesce(new.email,''), '@', 1), ''), 'Yere member');
  insert into public.profiles(id, display_name)
  values(new.id, left(display_name, 80))
  on conflict(id) do nothing;
  insert into public.workspace_security(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_yere on auth.users;
create trigger on_auth_user_created_yere
after insert on auth.users for each row execute procedure public.handle_new_yere_user();

create table if not exists public.user_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 48),
  color text not null default 'indigo' check (color in ('indigo','amber','emerald','rose','sky')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, id)
);
create unique index if not exists user_lists_owner_name_lower_idx on public.user_lists(owner_id, lower(name));

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid references auth.users(id) on delete set null,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  invited_email text,
  invited_phone text,
  status text not null default 'invited' check (status in ('invited','pending','approved','revoked')),
  approval_mode text not null default 'direct' check (approval_mode in ('direct','require_approval')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, id),
  check (invited_email is null or char_length(invited_email) <= 320),
  check (invited_phone is null or char_length(invited_phone) <= 32)
);
create index if not exists contacts_owner_status_idx on public.contacts(owner_id, status, created_at desc);
create index if not exists contacts_invitee_idx on public.contacts(contact_user_id, status);
create unique index if not exists contacts_owner_email_idx on public.contacts(owner_id, lower(invited_email)) where invited_email is not null and status <> 'revoked';
create unique index if not exists contacts_owner_phone_idx on public.contacts(owner_id, invited_phone) where invited_phone is not null and status <> 'revoked';
create unique index if not exists contacts_owner_user_active_idx on public.contacts(owner_id, contact_user_id) where contact_user_id is not null and status in ('pending','approved');

-- A browser session may approve/revoke a relationship but cannot attach an arbitrary user to it.
create or replace function public.protect_contact_relationship()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then raise exception 'Contacts must be created through the invitation service'; end if;
  if new.owner_id is distinct from old.owner_id
    or new.contact_user_id is distinct from old.contact_user_id
    or new.invited_email is distinct from old.invited_email
    or new.invited_phone is distinct from old.invited_phone then
    raise exception 'Invitation identity fields cannot be changed by a browser session';
  end if;
  if new.status = 'invited' and old.status <> 'invited' then raise exception 'A relationship cannot be reset to invited'; end if;
  if new.status in ('pending','approved') and new.contact_user_id is null then raise exception 'A contact must accept an invitation first'; end if;
  return new;
end;
$$;
drop trigger if exists protect_contact_relationship on public.contacts;
create trigger protect_contact_relationship before insert or update on public.contacts
for each row execute procedure public.protect_contact_relationship();

create table if not exists public.contact_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  invite_type text not null check (invite_type in ('code','email','sms')),
  secret_hash text not null unique,
  invited_email text,
  invited_phone text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  check (expires_at > created_at),
  check (invite_type <> 'email' or invited_email is not null),
  check (invite_type <> 'sms' or invited_phone is not null)
);
create index if not exists contact_invites_owner_idx on public.contact_invites(owner_id, created_at desc);
create index if not exists contact_invites_contact_idx on public.contact_invites(contact_id);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(trim(title)) between 1 and 180),
  notes text check (notes is null or char_length(notes) <= 4000),
  url text check (url is null or char_length(url) <= 2048),
  due_at timestamptz not null,
  recurrence jsonb,
  is_completed boolean not null default false,
  completed_at timestamptz,
  approval_status text not null default 'approved' check (approval_status in ('pending','approved','rejected')),
  from_contact_id uuid references public.contacts(id) on delete set null,
  list_id uuid,
  reminder_type text not null default 'standard' check (reminder_type in ('standard','expiry','renewal')),
  delivery_channel text not null default 'push' check (delivery_channel in ('push','email','both','none')),
  cost numeric(12,2) check (cost is null or cost >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(owner_id, list_id) references public.user_lists(owner_id, id) on delete set null (list_id),
  check ((is_completed and completed_at is not null) or (not is_completed))
);
create index if not exists reminders_owner_due_idx on public.reminders(owner_id, due_at) where approval_status = 'approved';
create index if not exists reminders_due_pending_idx on public.reminders(due_at) where not is_completed and approval_status = 'approved';
create index if not exists reminders_owner_list_idx on public.reminders(owner_id, list_id, sort_order);
create index if not exists reminders_from_contact_idx on public.reminders(from_contact_id) where from_contact_id is not null;

-- Delegated reminders are inserted by a server function; their attribution cannot be forged client-side.
create or replace function public.protect_reminder_attribution()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.owner_id <> auth.uid() or new.created_by <> auth.uid() or new.from_contact_id is not null then
      raise exception 'Shared reminders must be created through the trusted-contact service';
    end if;
  elsif new.owner_id is distinct from old.owner_id
    or new.created_by is distinct from old.created_by
    or new.from_contact_id is distinct from old.from_contact_id then
    raise exception 'Reminder ownership and sender attribution cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_reminder_attribution on public.reminders;
create trigger protect_reminder_attribution before insert or update on public.reminders
for each row execute procedure public.protect_reminder_attribution();

create table if not exists public.reminder_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  unique(owner_id, reminder_id, id)
);
create index if not exists reminder_attachments_owner_idx on public.reminder_attachments(owner_id, reminder_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions(owner_id);

create table if not exists public.reminder_fires (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz not null,
  fired_at timestamptz not null default now(),
  channel text not null,
  delivery_status text not null default 'queued' check (delivery_status in ('queued','sent','partial','failed','skipped')),
  error_message text,
  unique(reminder_id, due_at)
);
create index if not exists reminder_fires_owner_idx on public.reminder_fires(owner_id, fired_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Yere',
  action text not null check (char_length(action) between 1 and 100),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_owner_created_idx on public.audit_logs(owner_id, created_at desc);

create table if not exists public.contact_blocks (
  owner_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key(owner_id, blocked_user_id)
);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  action text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0)
);

create table if not exists public.workspace_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_invite_attempts integer not null default 0 check (failed_invite_attempts >= 0),
  attempt_window_started_at timestamptz not null default now(),
  suspended_until timestamptz,
  updated_at timestamptz not null default now()
);

-- All private application tables use RLS. Token hashes and fire ledgers have no end-user policies.
alter table public.profiles enable row level security;
alter table public.user_lists enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_invites enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_attachments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_fires enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contact_blocks enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.workspace_security enable row level security;

-- Profiles are visible and writable only by their authenticated owner.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- User-owned lists and contacts are isolated by owner_id.
drop policy if exists user_lists_owner_all on public.user_lists;
create policy user_lists_owner_all on public.user_lists for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists contacts_owner_all on public.contacts;
drop policy if exists contacts_owner_select on public.contacts;
create policy contacts_owner_select on public.contacts for select to authenticated using (owner_id = auth.uid());
drop policy if exists contacts_owner_update on public.contacts;
create policy contacts_owner_update on public.contacts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Never expose invite hashes to browser roles; Edge Functions use the server-only service role.
-- No authenticated/anon policy is created on public.contact_invites.

-- Reminder owners have full access. Invited contacts cannot read an owner's other reminders.
drop policy if exists reminders_owner_select on public.reminders;
create policy reminders_owner_select on public.reminders for select to authenticated using (owner_id = auth.uid());
drop policy if exists reminders_owner_insert on public.reminders;
create policy reminders_owner_insert on public.reminders for insert to authenticated with check (
  owner_id = auth.uid() and created_by = auth.uid() and from_contact_id is null
);
drop policy if exists reminders_owner_update on public.reminders;
create policy reminders_owner_update on public.reminders for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists reminders_owner_delete on public.reminders;
create policy reminders_owner_delete on public.reminders for delete to authenticated using (owner_id = auth.uid());

drop policy if exists reminder_attachments_owner_all on public.reminder_attachments;
create policy reminder_attachments_owner_all on public.reminder_attachments for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid() and exists (select 1 from public.reminders r where r.id = reminder_id and r.owner_id = auth.uid()));

drop policy if exists push_subscriptions_owner_all on public.push_subscriptions;
create policy push_subscriptions_owner_all on public.push_subscriptions for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists audit_logs_owner_select on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs for select to authenticated using (owner_id = auth.uid());
drop policy if exists contact_blocks_owner_all on public.contact_blocks;
create policy contact_blocks_owner_all on public.contact_blocks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists workspace_security_owner_select on public.workspace_security;
create policy workspace_security_owner_select on public.workspace_security for select to authenticated using (user_id = auth.uid());
-- rate_limit_buckets and reminder_fires are server-only (service role bypasses RLS).

-- Private attachment bucket: object keys begin with the authenticated user's UUID.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'yere-attachments', 'yere-attachments', false, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict(id) do update set public = false, file_size_limit = 10485760;

drop policy if exists yere_attachment_read_own on storage.objects;
create policy yere_attachment_read_own on storage.objects for select to authenticated
using (bucket_id = 'yere-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists yere_attachment_insert_own on storage.objects;
create policy yere_attachment_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'yere-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists yere_attachment_update_own on storage.objects;
create policy yere_attachment_update_own on storage.objects for update to authenticated
using (bucket_id = 'yere-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'yere-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists yere_attachment_delete_own on storage.objects;
create policy yere_attachment_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'yere-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Keep updated_at consistent for mutable tables.
do $$
declare t text;
begin
  foreach t in array array['profiles','user_lists','contacts','reminders','push_subscriptions','workspace_security'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t);
  end loop;
end;
$$;

-- Only expose safe invite metadata to the owner; secret_hash is never returned.
create or replace function public.list_my_contact_invites()
returns table(id uuid, invite_type text, invited_email text, invited_phone text, expires_at timestamptz, consumed_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select ci.id, ci.invite_type, ci.invited_email, ci.invited_phone, ci.expires_at, ci.consumed_at, ci.revoked_at
  from public.contact_invites ci where ci.owner_id = auth.uid() and ci.expires_at > now() and ci.revoked_at is null
  order by ci.created_at desc limit 100;
$$;
revoke all on function public.list_my_contact_invites() from public, anon;
grant execute on function public.list_my_contact_invites() to authenticated;

-- An accepted contact sees only the account name and approval mode of the person they can help.
create or replace function public.list_my_relationships()
returns table(owner_id uuid, owner_name text, approval_mode text)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select c.owner_id, p.display_name, c.approval_mode
  from public.contacts c join public.profiles p on p.id = c.owner_id
  where c.contact_user_id = auth.uid() and c.status = 'approved'
  order by p.display_name;
$$;
revoke all on function public.list_my_relationships() from public, anon;
grant execute on function public.list_my_relationships() to authenticated;

-- Audit events are append-only from the browser and attributed to the signed-in account.
create or replace function public.record_user_audit(p_action text, p_details text default '')
returns uuid
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare new_id uuid;
declare actor text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(coalesce(p_action,'')) < 1 or char_length(p_action) > 100 then raise exception 'Invalid audit action'; end if;
  select display_name into actor from public.profiles where id = auth.uid();
  insert into public.audit_logs(owner_id, actor_id, actor_name, action, details)
  values(auth.uid(), auth.uid(), coalesce(actor,'Yere member'), p_action, left(coalesce(p_details,''),500))
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.record_user_audit(text,text) from public, anon;
grant execute on function public.record_user_audit(text,text) to authenticated;

-- Atomic fixed-window rate limiter. Only trusted Edge Functions may consume buckets.
create or replace function public.consume_rate_limit(p_bucket_key text, p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or char_length(p_bucket_key) > 200 then return false; end if;
  insert into public.rate_limit_buckets(bucket_key,action,window_started_at,hit_count)
  values(p_bucket_key,p_action,now(),1)
  on conflict(bucket_key) do update set
    action=excluded.action,
    hit_count=case when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1 else public.rate_limit_buckets.hit_count + 1 end,
    window_started_at=case when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now() then now() else public.rate_limit_buckets.window_started_at end
  returning hit_count into hits;
  return hits <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.register_failed_invite_attempt(p_user_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare suspended timestamptz;
begin
  insert into public.workspace_security(user_id,failed_invite_attempts,attempt_window_started_at,suspended_until)
  values(p_user_id,1,now(),null)
  on conflict(user_id) do update set
    failed_invite_attempts=case when public.workspace_security.attempt_window_started_at + interval '1 hour' <= now() then 1 else public.workspace_security.failed_invite_attempts + 1 end,
    attempt_window_started_at=case when public.workspace_security.attempt_window_started_at + interval '1 hour' <= now() then now() else public.workspace_security.attempt_window_started_at end,
    suspended_until=case
      when (case when public.workspace_security.attempt_window_started_at + interval '1 hour' <= now() then 1 else public.workspace_security.failed_invite_attempts + 1 end) >= 12 then now() + interval '1 hour'
      else public.workspace_security.suspended_until
    end,
    updated_at=now()
  returning suspended_until into suspended;
  return suspended;
end;
$$;
revoke all on function public.register_failed_invite_attempt(uuid) from public, anon, authenticated;
grant execute on function public.register_failed_invite_attempt(uuid) to service_role;

-- Redeem a one-time code/link exactly once. Lock the invite row to close concurrent redemption races.
create or replace function public.consume_contact_invite(p_secret_hash text, p_invite_type text, p_contact_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare invite_row public.contact_invites%rowtype;
declare blocked boolean;
begin
  select * into invite_row from public.contact_invites
  where secret_hash = p_secret_hash
    and (invite_type = p_invite_type or (p_invite_type = 'link' and invite_type in ('email','sms')))
  for update;
  if not found then return jsonb_build_object('ok',false,'reason','invalid'); end if;
  if invite_row.revoked_at is not null or invite_row.consumed_at is not null or invite_row.expires_at <= now() then
    return jsonb_build_object('ok',false,'reason','expired');
  end if;
  select exists(select 1 from public.contact_blocks b where b.owner_id=invite_row.owner_id and b.blocked_user_id=p_contact_user_id) into blocked;
  if blocked then return jsonb_build_object('ok',false,'reason','blocked'); end if;
  if exists(select 1 from public.contacts c where c.owner_id=invite_row.owner_id and c.contact_user_id=p_contact_user_id and c.status in ('pending','approved')) then
    return jsonb_build_object('ok',false,'reason','already_connected');
  end if;
  update public.contact_invites set consumed_at=now() where id=invite_row.id;
  update public.contacts set contact_user_id=p_contact_user_id,status='pending'
  where id=invite_row.contact_id and owner_id=invite_row.owner_id;
  insert into public.audit_logs(owner_id,actor_id,actor_name,action,details)
  values(invite_row.owner_id,p_contact_user_id,'Trusted contact','invite accepted','A contact accepted an invitation and is waiting for approval.');
  return jsonb_build_object('ok',true,'invite_id',invite_row.id,'owner_id',invite_row.owner_id,'contact_id',invite_row.contact_id);
end;
$$;
revoke all on function public.consume_contact_invite(text,text,uuid) from public, anon, authenticated;
grant execute on function public.consume_contact_invite(text,text,uuid) to service_role;

-- Realtime is used by the app for collaborative updates.
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.user_lists;
