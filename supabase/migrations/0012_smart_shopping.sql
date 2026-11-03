-- Run once after 0011. A shopping list that knows quantities, remembers the house's habits and keeps a history.
--
-- Items: a number and a unit next to the free note (the old `quantity_note` stays the note; the app reads a
-- plain "2 ליטר" there as a quantity and writes it back split, so nothing is lost). A substitute preference,
-- "not found" in the store, who bought it, who else asked for it, and the event or task it's for.
-- Trips: finishing a shopping trip files the bought items under it instead of deleting them, so it can be
-- undone and the house's history drives suggestions. Finishing and undoing happen inside the database, so a
-- double tap, a retry or both phones at once never file the same items twice.
-- Tombstones: a deleted item can't come back from a late save on the other phone.

alter table public.shopping_items
  add column quantity numeric check (quantity > 0 and quantity < 100000),
  add column unit text check (unit in ('unit', 'pack', 'kg', 'g', 'l', 'ml')),
  add column substitute_mode text check (substitute_mode in ('allowed', 'none', 'specific')),
  add column substitute text check (length(substitute) <= 120),
  add column missing_at timestamptz,
  add column checked_by uuid references public.profiles (id) on delete set null,
  add column requested_by uuid[] not null default '{}',
  add column event_id uuid references public.events (id) on delete set null,
  add column task_id uuid references public.tasks (id) on delete set null,
  add column trip_id uuid,
  add column updated_at timestamptz not null default now();

create function public.shopping_item_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shopping_items_touch before update on public.shopping_items
  for each row execute function public.shopping_item_touch();

-- A link points at an event or task of the same house (the foreign key alone would accept another house's id).
create function public.shopping_item_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_id is not null and not exists (
    select 1 from public.events where id = new.event_id and household_id = new.household_id
  ) then
    raise exception 'event' using errcode = '23503';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks where id = new.task_id and household_id = new.household_id
  ) then
    raise exception 'task' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger shopping_items_links before insert or update of event_id, task_id on public.shopping_items
  for each row execute function public.shopping_item_links();

-- No foreign key to households: a closing house deletes its items in the same statement.
create table public.shopping_item_tombstones (
  id uuid primary key,
  household_id uuid not null,
  deleted_at timestamptz not null default now()
);

alter table public.shopping_item_tombstones enable row level security;

create function public.shopping_item_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shopping_item_tombstones (id, household_id) values (old.id, old.household_id)
  on conflict (id) do nothing;
  return old;
end;
$$;

create trigger shopping_items_tombstone after delete on public.shopping_items
  for each row execute function public.shopping_item_tombstone();

-- HM410: the app drops the change and the row, instead of bringing the item back.
create function public.shopping_item_not_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.shopping_item_tombstones where id = new.id) then
    raise exception 'gone' using errcode = 'HM410';
  end if;
  return new;
end;
$$;

create trigger shopping_items_not_gone before insert on public.shopping_items
  for each row execute function public.shopping_item_not_gone();

create table public.shopping_trips (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  finished_by uuid references public.profiles (id) on delete set null,
  finished_at timestamptz not null default now(),
  undone_at timestamptz,
  items jsonb not null default '[]'::jsonb,
  missing jsonb not null default '[]'::jsonb
);

create index shopping_trips_household on public.shopping_trips (household_id, finished_at desc);

alter table public.shopping_items
  add constraint shopping_items_trip foreign key (trip_id) references public.shopping_trips (id) on delete set null;

create index shopping_items_active on public.shopping_items (household_id, created_at desc) where trip_id is null;

alter table public.shopping_trips enable row level security;

create policy "household reads trips" on public.shopping_trips
  for select using (household_id = public.my_household_id());

-- One house finishes one trip at a time. The trip id comes from the phone, so a retry finds the trip it made.
-- Only items that are bought and not filed yet join it: the other phone finishing at the same moment gets "empty".
create function public.finish_shopping_trip(trip uuid, item_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  found_trip public.shopping_trips%rowtype;
  claimed uuid[];
  bought jsonb;
  left_behind jsonb;
begin
  if me is null or house is null then raise exception 'auth'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopping-trip:' || house::text, 0));

  select * into found_trip from public.shopping_trips where id = trip;
  if found then
    if found_trip.household_id <> house then raise exception 'missing'; end if;
    return jsonb_build_object('status', 'done', 'trip', to_jsonb(found_trip));
  end if;

  select
    coalesce(array_agg(s.id), '{}'),
    coalesce(jsonb_agg(jsonb_build_object(
      'item_id', s.id, 'name', s.name, 'quantity', s.quantity, 'unit', s.unit, 'note', s.quantity_note,
      'category', s.category, 'added_by', s.added_by, 'checked_by', s.checked_by, 'checked_at', s.checked_at,
      'event_id', s.event_id
    ) order by s.checked_at), '[]'::jsonb)
  into claimed, bought
  from public.shopping_items s
  where s.household_id = house and s.id = any(item_ids) and s.checked_at is not null and s.trip_id is null;

  if cardinality(claimed) = 0 then
    return jsonb_build_object('status', 'empty');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', s.id, 'name', s.name)), '[]'::jsonb)
  into left_behind
  from public.shopping_items s
  where s.household_id = house and s.trip_id is null and s.checked_at is null and s.missing_at is not null;

  insert into public.shopping_trips (id, household_id, finished_by, items, missing)
  values (trip, house, me, bought, left_behind)
  returning * into found_trip;

  update public.shopping_items set trip_id = trip where id = any(claimed);
  return jsonb_build_object('status', 'done', 'trip', to_jsonb(found_trip));
end;
$$;

-- Undoing a trip puts its items back as they are now: a change the other parent made since stays.
create function public.undo_shopping_trip(trip uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  found_trip public.shopping_trips%rowtype;
  restored integer;
begin
  if me is null or house is null then raise exception 'auth'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shopping-trip:' || house::text, 0));
  select * into found_trip from public.shopping_trips where id = trip and household_id = house;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if found_trip.undone_at is not null then return jsonb_build_object('status', 'done', 'restored', 0); end if;
  update public.shopping_trips set undone_at = now() where id = trip;
  update public.shopping_items set trip_id = null where trip_id = trip and household_id = house;
  get diagnostics restored = row_count;
  return jsonb_build_object('status', 'done', 'restored', restored);
end;
$$;

revoke all on function public.finish_shopping_trip(uuid, uuid[]) from public;
revoke all on function public.undo_shopping_trip(uuid) from public;
grant execute on function public.finish_shopping_trip(uuid, uuid[]) to authenticated;
grant execute on function public.undo_shopping_trip(uuid) to authenticated;

-- What the house knows about a product, by item key: a staple, how it usually buys it, the name it settled
-- on after a correction, and a suggestion someone waved away for now.
create table public.shopping_products (
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null check (length(item_key) between 1 and 120),
  name text check (length(name) between 1 and 120),
  staple boolean not null default false,
  quantity numeric check (quantity > 0 and quantity < 100000),
  unit text check (unit in ('unit', 'pack', 'kg', 'g', 'l', 'ml')),
  note text check (length(note) <= 120),
  renamed_to text check (length(renamed_to) between 1 and 120),
  dismissed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, item_key)
);

alter table public.shopping_products enable row level security;

create policy "household reads products" on public.shopping_products
  for select using (household_id = public.my_household_id());
create policy "household adds products" on public.shopping_products
  for insert with check (household_id = public.my_household_id());
create policy "household changes products" on public.shopping_products
  for update using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy "household removes products" on public.shopping_products
  for delete using (household_id = public.my_household_id());

-- Two names a parent said are different products, for both phones.
create table public.shopping_kept_apart (
  household_id uuid not null references public.households (id) on delete cascade,
  pair_key text not null check (length(pair_key) between 3 and 250),
  created_at timestamptz not null default now(),
  primary key (household_id, pair_key)
);

alter table public.shopping_kept_apart enable row level security;

create policy "household reads kept apart" on public.shopping_kept_apart
  for select using (household_id = public.my_household_id());
create policy "household keeps apart" on public.shopping_kept_apart
  for insert with check (household_id = public.my_household_id());
create policy "household merges again" on public.shopping_kept_apart
  for delete using (household_id = public.my_household_id());

-- Saved sets ("weekly", "barbecue", "cleaning"): products to pick from, added only after choosing.
create table public.shopping_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_groups_household on public.shopping_groups (household_id, created_at);

alter table public.shopping_groups enable row level security;

create policy "household reads groups" on public.shopping_groups
  for select using (household_id = public.my_household_id());
create policy "household adds groups" on public.shopping_groups
  for insert with check (household_id = public.my_household_id() and created_by = auth.uid());
create policy "household changes groups" on public.shopping_groups
  for update using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy "household removes groups" on public.shopping_groups
  for delete using (household_id = public.my_household_id());

alter publication supabase_realtime add table public.shopping_trips;
alter publication supabase_realtime add table public.shopping_products;
alter publication supabase_realtime add table public.shopping_kept_apart;
alter publication supabase_realtime add table public.shopping_groups;
