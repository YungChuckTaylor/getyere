-- Accepting an invitation establishes the trusted relationship immediately.
-- The contact's approval_mode still controls whether delegated reminders need review.
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
  select exists(
    select 1 from public.contact_blocks b
    where (b.owner_id=invite_row.owner_id and b.blocked_user_id=p_contact_user_id)
       or (b.owner_id=p_contact_user_id and b.blocked_user_id=invite_row.owner_id)
  ) into blocked;
  if blocked then return jsonb_build_object('ok',false,'reason','blocked'); end if;
  if exists(select 1 from public.contacts c where c.owner_id=invite_row.owner_id and c.contact_user_id=p_contact_user_id and c.status in ('pending','approved')) then
    return jsonb_build_object('ok',false,'reason','already_connected');
  end if;
  update public.contact_invites set consumed_at=now() where id=invite_row.id;
  update public.contacts set contact_user_id=p_contact_user_id,status='approved'
  where id=invite_row.contact_id and owner_id=invite_row.owner_id;
  insert into public.audit_logs(owner_id,actor_id,actor_name,action,details)
  values(invite_row.owner_id,p_contact_user_id,'Trusted contact','invite accepted','A contact accepted the invitation and the trusted relationship was approved automatically.');
  return jsonb_build_object('ok',true,'invite_id',invite_row.id,'owner_id',invite_row.owner_id,'contact_id',invite_row.contact_id);
end;
$$;
revoke all on function public.consume_contact_invite(text,text,uuid) from public, anon, authenticated;
grant execute on function public.consume_contact_invite(text,text,uuid) to service_role;

-- Contacts who already accepted an invite before this change are approved as well.
with accepted_pending_contacts as (
  update public.contacts c
  set status='approved', updated_at=now()
  where c.status='pending'
    and exists (
      select 1 from public.contact_invites ci
      where ci.contact_id=c.id and ci.owner_id=c.owner_id and ci.consumed_at is not null
    )
    and not exists (
      select 1 from public.contact_blocks b
      where (b.owner_id=c.owner_id and b.blocked_user_id=c.contact_user_id)
         or (b.owner_id=c.contact_user_id and b.blocked_user_id=c.owner_id)
    )
  returning c.owner_id,c.contact_user_id
)
insert into public.audit_logs(owner_id,actor_id,actor_name,action,details)
select owner_id,contact_user_id,'Yere','approved contact','Previously accepted invitation was approved automatically during the Yere update.'
from accepted_pending_contacts;

-- Let an approved contact choose one of the account owner's list names for a new delegated reminder.
-- Only list metadata is exposed; the caller cannot read the owner's reminders or list contents.
create or replace function public.list_delegated_lists(p_owner_id uuid)
returns table(id uuid, name text, color text, sort_order integer)
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.contacts c
    where c.owner_id=p_owner_id and c.contact_user_id=auth.uid() and c.status='approved'
  ) then raise exception 'An active trusted relationship is required'; end if;
  if exists (
    select 1 from public.contact_blocks b
    where (b.owner_id=p_owner_id and b.blocked_user_id=auth.uid())
       or (b.owner_id=auth.uid() and b.blocked_user_id=p_owner_id)
  ) then raise exception 'This trusted relationship is unavailable'; end if;
  return query
    select l.id,l.name,l.color,l.sort_order
    from public.user_lists l
    where l.owner_id=p_owner_id
    order by l.sort_order,l.name;
end;
$$;
revoke all on function public.list_delegated_lists(uuid) from public, anon;
grant execute on function public.list_delegated_lists(uuid) to authenticated;
