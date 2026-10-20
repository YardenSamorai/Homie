-- Run once after 0001. Creating a house has to happen inside the database:
-- a new household is invisible to its owner until they are a member, so the app cannot insert both rows itself.

create or replace function public.create_household(house_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid := gen_random_uuid();
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already';
  end if;
  if length(trim(house_name)) = 0 then
    raise exception 'name';
  end if;
  insert into public.households (id, name, created_by) values (hid, trim(house_name), uid);
  insert into public.household_members (household_id, user_id, role, color)
  values (hid, uid, 'admin', '#5a5f94');
  return hid;
end;
$$;

create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite public.household_invites%rowtype;
  members integer;
begin
  if uid is null then
    raise exception 'auth';
  end if;
  select * into invite from public.household_invites where token = invite_token;
  if not found or invite.revoked_at is not null then
    raise exception 'missing';
  end if;
  if invite.accepted_by is not null then
    raise exception 'used';
  end if;
  if invite.expires_at < now() then
    raise exception 'expired';
  end if;
  if exists (
    select 1 from public.household_members where user_id = uid and household_id <> invite.household_id
  ) then
    raise exception 'already';
  end if;
  select count(*) into members from public.household_members where household_id = invite.household_id;
  if members >= 2 then
    raise exception 'full';
  end if;
  if not exists (select 1 from public.household_members where user_id = uid) then
    insert into public.household_members (household_id, user_id, role, color)
    values (invite.household_id, uid, 'member', '#c48b9f');
  end if;
  update public.household_invites set accepted_by = uid where id = invite.id;
  return invite.household_id;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.accept_invite(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

create or replace function public.preview_invite(invite_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite public.household_invites%rowtype;
  house_name text;
  inviter text;
  members integer;
  status text := 'ok';
begin
  select * into invite from public.household_invites where token = invite_token;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  select name into house_name from public.households where id = invite.household_id;
  select display_name into inviter from public.profiles where id = invite.created_by;
  select count(*) into members from public.household_members where household_id = invite.household_id;
  if invite.revoked_at is not null then
    status := 'revoked';
  elsif invite.accepted_by is not null then
    status := 'used';
  elsif invite.expires_at < now() then
    status := 'expired';
  elsif members >= 2 then
    status := 'full';
  end if;
  return jsonb_build_object(
    'status', status,
    'household_id', case when status in ('ok', 'full') then invite.household_id else null end,
    'household_name', case when status in ('ok', 'full') then house_name else null end,
    'inviter_name', case when status = 'ok' then inviter else null end,
    'expires_at', case when status = 'ok' then invite.expires_at else null end
  );
end;
$$;

revoke all on function public.preview_invite(text) from public;
grant execute on function public.preview_invite(text) to anon, authenticated;

