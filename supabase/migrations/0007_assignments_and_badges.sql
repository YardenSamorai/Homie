-- Run once after 0006. A task given to the other parent gets its own notification,
-- and each notification carries how many things are new for that parent (the red number on the app icon).

alter table public.activity drop constraint activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('task_added', 'task_assigned', 'task_done', 'shopping_added', 'shopping_bought', 'event_added', 'story_added'));

-- Now also says whose phone it is, so the server can count what's new for that parent.
drop function public.partner_push_devices();

create function public.partner_push_devices()
returns table (token text, locale text, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select d.token, d.locale, d.user_id
  from public.push_devices d
  join public.household_members m on m.user_id = d.user_id
  where m.household_id = public.my_household_id() and d.user_id <> auth.uid();
$$;

revoke all on function public.partner_push_devices() from public;
grant execute on function public.partner_push_devices() to authenticated;
