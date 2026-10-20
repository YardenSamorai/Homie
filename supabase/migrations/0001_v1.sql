-- Homie V1. Run once in the Supabase SQL editor for the project named "homie".
-- Auth stays Supabase Auth (email OTP). This file is the household data and its rules.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'he' check (locale in ('he', 'en')),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Jerusalem',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  color text not null,
  primary key (household_id, user_id),
  unique (user_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity_note text,
  checked_at timestamptz,
  is_checked boolean generated always as (checked_at is not null) stored,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  prep_note text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  note text,
  assignee_id uuid not null references public.profiles (id),
  due_date date,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly')),
  spawned_from_id uuid unique references public.tasks (id),
  edited_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (recurrence = 'none' or due_date is not null)
);

create index shopping_items_household on public.shopping_items (household_id, created_at desc);
create index tasks_household on public.tasks (household_id) where deleted_at is null;
create index events_household on public.events (household_id, date) where deleted_at is null;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.shopping_items enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;

create function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

create function public.am_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid() and role = 'admin' and household_id = public.my_household_id()
  )
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or id in (
    select user_id from public.household_members where household_id = public.my_household_id()
  ));

create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "read own household" on public.households
  for select using (id = public.my_household_id());

create policy "admin renames household" on public.households
  for update using (id = public.my_household_id() and public.am_admin());

create policy "read household members" on public.household_members
  for select using (household_id = public.my_household_id());

create policy "read household invites" on public.household_invites
  for select using (household_id = public.my_household_id() and public.am_admin());

create policy "admin writes invites" on public.household_invites
  for insert with check (household_id = public.my_household_id() and public.am_admin() and created_by = auth.uid());

create policy "admin revokes invites" on public.household_invites
  for update using (household_id = public.my_household_id() and public.am_admin());

create policy "household reads shopping" on public.shopping_items
  for select using (household_id = public.my_household_id());

create policy "household writes shopping" on public.shopping_items
  for insert with check (household_id = public.my_household_id() and added_by = auth.uid());

create policy "household updates shopping" on public.shopping_items
  for update using (household_id = public.my_household_id());

create policy "household deletes shopping" on public.shopping_items
  for delete using (household_id = public.my_household_id());

create policy "household reads tasks" on public.tasks
  for select using (household_id = public.my_household_id());

create policy "household writes tasks" on public.tasks
  for insert with check (household_id = public.my_household_id() and created_by = auth.uid());

create policy "household updates tasks" on public.tasks
  for update using (household_id = public.my_household_id());

create policy "household reads events" on public.events
  for select using (household_id = public.my_household_id());

create policy "household writes events" on public.events
  for insert with check (household_id = public.my_household_id() and created_by = auth.uid());

create policy "household updates events" on public.events
  for update using (household_id = public.my_household_id());

alter publication supabase_realtime add table public.shopping_items;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.events;
