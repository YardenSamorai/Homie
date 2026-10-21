-- Run once after 0003. The bell's activity feed and the iPhones that get a notification for it.

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('task_added', 'task_done', 'shopping_added', 'shopping_bought', 'event_added')),
  subject_id uuid,
  title text not null check (length(title) between 1 and 200),
  created_at timestamptz not null default now()
);

create index activity_household on public.activity (household_id, created_at desc);

alter table public.activity enable row level security;

create policy "household reads activity" on public.activity
  for select using (household_id = public.my_household_id());

create policy "parents log their own activity" on public.activity
  for insert with check (household_id = public.my_household_id() and actor_id = auth.uid());

alter publication supabase_realtime add table public.activity;

-- Everything after this moment is "new" in the bell.
alter table public.profiles add column activity_seen_at timestamptz;

-- No policies: only the functions below reach it, so one parent never reads the other's tokens directly.
create table public.push_devices (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  locale text not null default 'he' check (locale in ('he', 'en')),
  updated_at timestamptz not null default now()
);

alter table public.push_devices enable row level security;

-- A phone that changes hands (sign out, sign in as the partner) moves to the new account.
create function public.register_push_device(device_token text, device_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  insert into public.push_devices (token, user_id, locale, updated_at)
  values (device_token, auth.uid(), case when device_locale = 'en' then 'en' else 'he' end, now())
  on conflict (token) do update set user_id = excluded.user_id, locale = excluded.locale, updated_at = now();
end;
$$;

create function public.forget_push_device(device_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_devices where token = device_token and user_id = auth.uid();
$$;

-- The other parent's phones: who hears about what this parent just did.
create function public.partner_push_devices()
returns table (token text, locale text)
language sql
stable
security definer
set search_path = public
as $$
  select d.token, d.locale
  from public.push_devices d
  join public.household_members m on m.user_id = d.user_id
  where m.household_id = public.my_household_id() and d.user_id <> auth.uid();
$$;

-- Apple said the token is gone (app removed, notifications off for good).
create function public.drop_partner_push_device(device_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_devices d
  using public.household_members m
  where d.token = device_token and m.user_id = d.user_id and m.household_id = public.my_household_id();
$$;

revoke all on function public.register_push_device(text, text) from public;
revoke all on function public.forget_push_device(text) from public;
revoke all on function public.partner_push_devices() from public;
revoke all on function public.drop_partner_push_device(text) from public;
grant execute on function public.register_push_device(text, text) to authenticated;
grant execute on function public.forget_push_device(text) to authenticated;
grant execute on function public.partner_push_devices() to authenticated;
grant execute on function public.drop_partner_push_device(text) to authenticated;
