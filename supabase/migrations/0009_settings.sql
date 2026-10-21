-- Run once after 0008. What each parent chose in Settings (which notifications, the morning summary,
-- how a new task starts), leaving the home or handing it over, and clearing the way to delete an account.

alter table public.profiles add column prefs jsonb not null default '{}'::jsonb;

-- Whoever else lives in a house, the admin first: who takes over what a leaving parent held.
create function public.house_heir(house uuid, leaving uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.household_members
  where household_id = house and user_id <> leaving
  order by (role = 'admin') desc
  limit 1;
$$;

revoke all on function public.house_heir(uuid, uuid) from public;

-- The admin hands the home to the other parent and stays as a member.
create function public.transfer_admin(member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
begin
  if me is null then raise exception 'auth'; end if;
  if not public.am_admin() then raise exception 'admin'; end if;
  if member_id = me or not exists (select 1 from public.household_members where household_id = house and user_id = member_id) then
    raise exception 'missing';
  end if;
  update public.household_members set role = 'admin' where household_id = house and user_id = member_id;
  update public.household_members set role = 'member' where household_id = house and user_id = me;
end;
$$;

-- Leaving: the other parent keeps the home (and becomes its admin), with this parent's open tasks.
-- Alone in it, leaving closes the home and everything in it.
create function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  heir uuid;
begin
  if me is null then raise exception 'auth'; end if;
  if house is null then raise exception 'missing'; end if;
  heir := public.house_heir(house, me);
  if heir is null then
    delete from public.households where id = house;
    return;
  end if;
  update public.household_members set role = 'admin' where household_id = house and user_id = heir and public.am_admin();
  update public.tasks set assignee_id = heir
  where household_id = house and assignee_id = me and completed_at is null and deleted_at is null;
  delete from public.stories where household_id = house and author_id = me;
  delete from public.household_members where household_id = house and user_id = me;
end;
$$;

-- Before an account is deleted (the server does that part): every row that names this parent passes to
-- whoever stays in that home, and a home nobody else lives in is closed. Then nothing blocks the deletion.
create function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'auth'; end if;

  if public.my_household_id() is not null and public.house_heir(public.my_household_id(), me) is not null then
    update public.household_members set role = 'admin'
    where household_id = public.my_household_id() and user_id = public.house_heir(public.my_household_id(), me) and public.am_admin();
  end if;

  delete from public.households h
  where public.house_heir(h.id, me) is null
    and (h.created_by = me or exists (select 1 from public.household_members m where m.household_id = h.id and m.user_id = me)
      or exists (select 1 from public.tasks t where t.household_id = h.id and (t.assignee_id = me or t.created_by = me or t.completed_by = me))
      or exists (select 1 from public.shopping_items s where s.household_id = h.id and s.added_by = me)
      or exists (select 1 from public.events e where e.household_id = h.id and e.created_by = me));

  update public.tasks set assignee_id = public.house_heir(household_id, me) where assignee_id = me;
  update public.tasks set created_by = public.house_heir(household_id, me) where created_by = me;
  update public.tasks set completed_by = public.house_heir(household_id, me) where completed_by = me;
  update public.shopping_items set added_by = public.house_heir(household_id, me) where added_by = me;
  update public.events set created_by = public.house_heir(household_id, me) where created_by = me;
  update public.households set created_by = public.house_heir(id, me) where created_by = me;
  update public.household_invites set created_by = public.house_heir(household_id, me) where created_by = me;
  update public.household_invites set accepted_by = null where accepted_by = me;
  delete from public.household_members where user_id = me;
end;
$$;

revoke all on function public.transfer_admin(uuid) from public;
revoke all on function public.leave_household() from public;
revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.transfer_admin(uuid) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;
