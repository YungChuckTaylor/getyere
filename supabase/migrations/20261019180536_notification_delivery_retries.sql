-- Service-only, bounded delivery leases. Existing fires are intentionally NOT replayed.
alter table public.reminder_fires
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists lease_id uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists delivery_state jsonb not null default '{}'::jsonb;

create index if not exists reminder_fires_retry_idx on public.reminder_fires(next_attempt_at)
  where next_attempt_at is not null;

create or replace function public.claim_due_reminder_fires(p_limit integer default 10)
returns setof public.reminder_fires
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  candidate record;
  claimed public.reminder_fires;
begin
  -- A worker killed on its final attempt must not leave a permanently queued fire.
  update public.reminder_fires set delivery_status='failed', next_attempt_at=null, lease_id=null, lease_until=null,
    error_message='Delivery attempts exhausted after an interrupted worker.'
  where attempt_count>=3 and delivery_status='queued' and lease_until<=now() and next_attempt_at is not null;

  for candidate in
    select r.id, r.owner_id, r.due_at, r.delivery_channel
    from public.reminders r
    left join public.reminder_fires f on f.reminder_id=r.id and f.due_at=r.due_at
    where not r.is_completed and r.approval_status='approved' and r.delivery_channel<>'none'
      and r.due_at between now()-interval '1 hour' and now()
      and (f.id is null or (
        f.next_attempt_at <= now() and f.attempt_count < 3
        and (f.lease_until is null or f.lease_until <= now())
        and f.delivery_status in ('queued','failed','partial')
      ))
    order by r.due_at, r.id
    limit greatest(1,least(coalesce(p_limit,10),25))
    for update of r skip locked
  loop
    insert into public.reminder_fires(reminder_id,owner_id,due_at,channel,next_attempt_at)
    values(candidate.id,candidate.owner_id,candidate.due_at,candidate.delivery_channel,now())
    on conflict(reminder_id,due_at) do nothing;

    update public.reminder_fires f
    set attempt_count=f.attempt_count+1, lease_id=gen_random_uuid(),
        lease_until=now()+interval '5 minutes', delivery_status='queued', fired_at=now()
    where f.reminder_id=candidate.id and f.due_at=candidate.due_at
      and f.attempt_count<3 and f.next_attempt_at<=now()
      and (f.lease_until is null or f.lease_until<=now())
      and f.delivery_status in ('queued','failed','partial')
    returning f.* into claimed;
    if found then return next claimed; end if;
  end loop;
end;
$$;
revoke all on function public.claim_due_reminder_fires(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminder_fires(integer) to service_role;

-- Keep target IDs stable on refresh, so a partial retry does not resend to an accepted device.
-- Upsert also serializes concurrent account reassignment through the unique token constraint.
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

  insert into public.push_subscriptions(owner_id, device_token, platform, provider, user_agent, updated_at)
  values(auth.uid(), p_device_token, p_platform, p_provider, left(p_user_agent, 250), now())
  on conflict (device_token) do update
    set owner_id=excluded.owner_id, platform=excluded.platform, provider=excluded.provider,
        user_agent=excluded.user_agent, updated_at=excluded.updated_at
  returning id into subscription_id;
  return subscription_id;
end;
$$;

revoke all on function public.register_native_push_token(text,text,text,text) from public, anon;
grant execute on function public.register_native_push_token(text,text,text,text) to authenticated;

