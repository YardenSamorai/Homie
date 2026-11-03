-- Run once after 0012. The house's pinned note on Today, and calendars read (never written) from Google and Outlook.
--
-- Privacy lives here, not in the screen: an imported event is readable only by the parent whose calendar it came
-- from. Everyone else in the house reads it through house_calendar(), which hands over the details, a busy block
-- (who and when, nothing else) or nothing at all, by the owner's choice for that calendar and the event's own
-- private flag. Tokens are sealed by the server and kept in tables no signed-in user can read.

-- The note ------------------------------------------------------------------------------------------------------

create sequence public.house_note_versions;

-- One note per house. `until` is the last house day it shows; null keeps it until someone takes it down.
-- Every write takes a fresh version from the sequence, so an edit made over a newer note is refused, never merged.
-- Taking it down empties the body instead of deleting the row: realtime can't hold a delete to the house's own
-- members, and the row's key is the house id.
create table public.house_notes (
  household_id uuid primary key references public.households (id) on delete cascade,
  body text check (body is null or char_length(btrim(body)) between 1 and 280),
  author_id uuid not null references public.profiles (id) on delete cascade,
  until date,
  version bigint not null default nextval('public.house_note_versions'),
  updated_at timestamptz not null default now()
);

alter table public.house_notes enable row level security;
create policy "house reads its note" on public.house_notes
  for select using (household_id = public.my_household_id());
alter publication supabase_realtime add table public.house_notes;

create function public.house_today(house uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce((select timezone from public.households where id = house), 'Asia/Jerusalem'))::date
$$;

-- seen_version is the note the writer was looking at (null: there was none). Anything else on the board now is
-- 'stale'; a note that was taken down in the meantime is 'gone'.
create function public.pin_house_note(note_body text, note_until date, seen_version bigint)
returns public.house_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  today date;
  board public.house_notes;
  live boolean;
  saved public.house_notes;
begin
  if me is null or house is null then raise exception 'auth'; end if;
  if note_body is null or char_length(btrim(note_body)) = 0 then raise exception 'empty'; end if;
  if char_length(btrim(note_body)) > 280 then raise exception 'long'; end if;
  today := public.house_today(house);
  if note_until is not null and note_until < today then raise exception 'past'; end if;

  select * into board from public.house_notes where household_id = house for update;
  live := found and board.body is not null and (board.until is null or board.until >= today);
  if live and seen_version is distinct from board.version then raise exception 'stale'; end if;
  if not live and seen_version is not null then raise exception 'gone'; end if;

  insert into public.house_notes as n (household_id, body, author_id, until)
  values (house, btrim(note_body), me, note_until)
  on conflict (household_id) do update
    set body = excluded.body, author_id = me, until = excluded.until,
        version = nextval('public.house_note_versions'), updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

create function public.clear_house_note(seen_version bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  house uuid := public.my_household_id();
begin
  if auth.uid() is null or house is null then raise exception 'auth'; end if;
  update public.house_notes
    set body = null, until = null, author_id = auth.uid(),
        version = nextval('public.house_note_versions'), updated_at = now()
    where household_id = house and version = seen_version and body is not null;
  if not found and exists (
    select 1 from public.house_notes
    where household_id = house and body is not null and (until is null or until >= public.house_today(house))
  ) then
    raise exception 'stale';
  end if;
end;
$$;

revoke all on function public.house_today(uuid) from public;
revoke all on function public.pin_house_note(text, date, bigint) from public;
revoke all on function public.clear_house_note(bigint) from public;
grant execute on function public.pin_house_note(text, date, bigint) to authenticated;
grant execute on function public.clear_house_note(bigint) to authenticated;

-- Calendars -----------------------------------------------------------------------------------------------------

-- A Google or Microsoft account one parent connected. `subject` is the provider's own id for the account, `email`
-- the address the provider verified. Only the server writes here.
create table public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  subject text not null,
  email text not null,
  status text not null default 'active' check (status in ('active', 'reauth', 'error')),
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, subject)
);

-- Sealed (AES-GCM, key on the server) access and refresh tokens. No policy: only the service role reads it.
create table public.calendar_secrets (
  account_id uuid primary key references public.calendar_accounts (id) on delete cascade,
  sealed text not null,
  updated_at timestamptz not null default now()
);

-- Each calendar in a connected account. Nothing is imported until the owner picks it and says who sees what:
-- `sharing` stays null (read as private) until that choice is made. `together` means the house shares this
-- calendar, so its events count both parents in unless someone declined.
create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.calendar_accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  remote_id text not null,
  source_key text not null,
  name text not null,
  color text,
  is_primary boolean not null default false,
  selected boolean not null default false,
  sharing text check (sharing in ('details', 'busy', 'private')),
  together boolean not null default false,
  last_synced_at timestamptz,
  last_error text,
  gone_at timestamptz,
  unique (account_id, remote_id),
  check (not selected or sharing is not null)
);

-- Where each calendar's sync stands: the provider's sync token or delta link and the window it covers.
create table public.calendar_sync_state (
  source_id uuid primary key references public.calendar_sources (id) on delete cascade,
  cursor text,
  window_start timestamptz,
  window_end timestamptz,
  full_at timestamptz
);

-- One imported event (one instance, for a series). `fix_key` names it across re-syncs and reconnects, so the
-- house's own corrections stay attached. Days are inclusive, in the house's time zone for timed events and as the
-- provider gave them for all-day ones.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.calendar_sources (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  remote_id text not null,
  fix_key text not null,
  series_id text,
  ical_uid text,
  title text,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_day date not null,
  end_day date not null,
  tentative boolean not null default false,
  busy boolean not null default true,
  marked_private boolean not null default false,
  people uuid[] not null default '{}',
  declined uuid[] not null default '{}',
  link text,
  updated_at timestamptz not null default now(),
  -- The run that last saw it. A full sync sweeps what it didn't see, and only once every page arrived.
  seen_in uuid,
  unique (source_id, remote_id),
  check (end_day >= start_day),
  check (all_day or (starts_at is not null and ends_at is not null))
);

create index calendar_events_house_days on public.calendar_events (household_id, start_day, end_day);
create index calendar_events_series on public.calendar_events (source_id, series_id) where series_id is not null;

-- The house's own layer over an imported event: who really takes part, and what to prepare. Never sent back to
-- the provider. Read only through house_calendar(), since a note on a private event is as private as the event.
create table public.calendar_event_fixes (
  household_id uuid not null references public.households (id) on delete cascade,
  fix_key text not null,
  source_key text not null,
  people uuid[],
  prep text check (prep is null or char_length(prep) <= 200),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, fix_key)
);

alter table public.calendar_accounts enable row level security;
alter table public.calendar_secrets enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_sync_state enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_fixes enable row level security;

revoke all on public.calendar_secrets from anon, authenticated;
revoke all on public.calendar_sync_state from anon, authenticated;
revoke all on public.calendar_event_fixes from anon, authenticated;
revoke insert, update, delete on public.calendar_accounts from anon, authenticated;
revoke insert, update, delete on public.calendar_sources from anon, authenticated;
revoke insert, update, delete on public.calendar_events from anon, authenticated;

create policy "parents read their own calendar accounts" on public.calendar_accounts
  for select using (user_id = auth.uid());
create policy "parents read their own calendars" on public.calendar_sources
  for select using (user_id = auth.uid());
create policy "parents read their own imported events" on public.calendar_events
  for select using (owner_id = auth.uid() and household_id = public.my_household_id());

-- The owner picks a calendar and who sees what. Turning one off removes what was imported from it.
create function public.choose_calendar(calendar_id uuid, pick boolean, share text, shared_by_house boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'auth'; end if;
  if share is not null and share not in ('details', 'busy', 'private') then raise exception 'sharing'; end if;
  if pick and share is null then raise exception 'sharing'; end if;
  update public.calendar_sources
  set selected = pick, sharing = coalesce(share, sharing), together = coalesce(shared_by_house, together)
  where id = calendar_id and user_id = me;
  if not found then raise exception 'missing'; end if;
  if not pick then
    delete from public.calendar_event_fixes f
    using public.calendar_sources s
    where s.id = calendar_id and f.source_key = s.source_key;
    delete from public.calendar_events where source_id = calendar_id;
    delete from public.calendar_sync_state where source_id = calendar_id;
  end if;
end;
$$;

-- What the signed-in parent may see of the house's imported events between two days.
--   details: everything the house keeps (title, people, prep, link to the source).
--   busy:    whose time it is, and when. No title, no people, no link, no prep, no calendar name.
-- A parent's own events are always details. A calendar not chosen, or chosen private, gives the others nothing;
-- an event marked private at the source is at most busy. A busy copy of a meeting the viewer can already see in
-- full, with the same parent in it, is left out rather than shown twice.
create function public.house_calendar(from_day date, to_day date)
returns table (
  id uuid,
  owner_id uuid,
  detail text,
  provider text,
  source_name text,
  title text,
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  start_day date,
  end_day date,
  tentative boolean,
  people uuid[],
  fixed boolean,
  prep text,
  link text,
  match_key text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid, public.my_household_id() as house
  ),
  members as (
    select coalesce(array_agg(m.user_id), '{}') as ids
    from public.household_members m
    where m.household_id = (select house from me)
  ),
  copies as (
    select
      e.*,
      s.name as calendar_name,
      a.provider as account_provider,
      f.people as fix_people,
      f.prep as fix_prep,
      case
        when e.owner_id = (select uid from me) then 'details'
        when s.sharing = 'details' and not e.marked_private then 'details'
        when s.sharing in ('details', 'busy') and e.busy then 'busy'
      end as level,
      coalesce(
        f.people,
        case when s.together
          then array(select unnest((select ids from members)) except select unnest(e.declined))
          else e.people
        end
      ) as who
    from public.calendar_events e
    join public.calendar_sources s on s.id = e.source_id
    join public.calendar_accounts a on a.id = s.account_id
    left join public.calendar_event_fixes f on f.household_id = e.household_id and f.fix_key = e.fix_key
    where (select uid from me) is not null
      and e.household_id = (select house from me)
      and exists (select 1 from public.household_members m where m.household_id = e.household_id and m.user_id = e.owner_id)
      and s.selected
      and s.gone_at is null
      and e.start_day <= to_day
      and e.end_day >= from_day
  )
  select
    c.id,
    c.owner_id,
    c.level,
    case when c.level = 'details' then c.account_provider end,
    case when c.level = 'details' then c.calendar_name end,
    case when c.level = 'details' then c.title end,
    c.all_day,
    c.starts_at,
    c.ends_at,
    c.start_day,
    c.end_day,
    c.tentative,
    case when c.level = 'details' then c.who else array[c.owner_id] end,
    c.level = 'details' and c.fix_people is not null,
    case when c.level = 'details' then c.fix_prep end,
    case when c.level = 'details' then c.link end,
    case when c.level = 'details' and c.ical_uid is not null
      then md5(c.ical_uid || '|' || coalesce(c.starts_at::text, c.start_day::text))
    end
  from copies c
  where c.level is not null
    and not (
      c.level = 'busy'
      and c.ical_uid is not null
      and exists (
        select 1 from copies seen
        where seen.level = 'details'
          and seen.id <> c.id
          and seen.ical_uid = c.ical_uid
          and seen.starts_at is not distinct from c.starts_at
          and seen.start_day = c.start_day
          and c.owner_id = any (seen.who)
      )
    )
  order by c.start_day, c.all_day desc, c.starts_at nulls first
$$;

-- A parent who can see an event in full may say who really takes part in it, or what to prepare. Empty clears.
create function public.fix_calendar_event(event_id uuid, taking_part uuid[], prep_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  target public.calendar_events;
  key text;
  people uuid[];
  note text := nullif(btrim(coalesce(prep_note, '')), '');
begin
  if me is null or house is null then raise exception 'auth'; end if;
  select e.* into target from public.calendar_events e where e.id = event_id and e.household_id = house;
  if not found or not exists (
    select 1 from public.house_calendar(target.start_day, target.end_day) v where v.id = event_id and v.detail = 'details'
  ) then
    raise exception 'missing';
  end if;
  if note is not null and char_length(note) > 200 then raise exception 'long'; end if;
  people := case when taking_part is null or cardinality(taking_part) = 0 then null else array(
    select distinct m.user_id from public.household_members m where m.household_id = house and m.user_id = any (taking_part)
  ) end;
  select s.source_key into key from public.calendar_sources s where s.id = target.source_id;

  if people is null and note is null then
    delete from public.calendar_event_fixes where household_id = house and fix_key = target.fix_key;
    return;
  end if;
  insert into public.calendar_event_fixes as f (household_id, fix_key, source_key, people, prep, updated_by)
  values (house, target.fix_key, key, people, note, me)
  on conflict (household_id, fix_key) do update
    set people = excluded.people, prep = excluded.prep, updated_by = me, updated_at = now();
end;
$$;

revoke all on function public.choose_calendar(uuid, boolean, text, boolean) from public;
revoke all on function public.house_calendar(date, date) from public;
revoke all on function public.fix_calendar_event(uuid, uuid[], text) from public;
grant execute on function public.choose_calendar(uuid, boolean, text, boolean) to authenticated;
grant execute on function public.house_calendar(date, date) to authenticated;
grant execute on function public.fix_calendar_event(uuid, uuid[], text) to authenticated;

-- Leaving a home, being removed from it, or deleting the account: what this parent imported into that home goes,
-- with the house's notes on it, and their calendars go back to "not chosen" so nothing flows into a next home
-- before they choose again.
create function public.forget_member_calendars()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.calendar_event_fixes f
  using public.calendar_sources s
  where s.user_id = old.user_id and f.household_id = old.household_id and f.source_key = s.source_key;
  delete from public.calendar_events where owner_id = old.user_id and household_id = old.household_id;
  delete from public.calendar_sync_state st
  using public.calendar_sources s
  where s.id = st.source_id and s.user_id = old.user_id;
  update public.calendar_sources set selected = false, sharing = null where user_id = old.user_id;
  return old;
end;
$$;

create trigger member_leaves_calendars
  after delete on public.household_members
  for each row execute function public.forget_member_calendars();
