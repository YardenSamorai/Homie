-- Run once after 0005. The house's admin can remove the other parent from Settings.
-- Their open tasks stay in the house (now the admin's); their status photos go.

create function public.remove_household_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
begin
  if me is null then
    raise exception 'auth';
  end if;
  if not public.am_admin() then
    raise exception 'admin';
  end if;
  if member_id = me then
    raise exception 'self';
  end if;
  if not exists (select 1 from public.household_members where household_id = house and user_id = member_id) then
    raise exception 'missing';
  end if;

  update public.tasks
  set assignee_id = me
  where household_id = house and assignee_id = member_id and completed_at is null and deleted_at is null;

  delete from public.stories where household_id = house and author_id = member_id;
  delete from public.household_members where household_id = house and user_id = member_id;
end;
$$;

revoke all on function public.remove_household_member(uuid) from public;
grant execute on function public.remove_household_member(uuid) to authenticated;
