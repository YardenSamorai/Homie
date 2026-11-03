-- Run once after 0013 (and 0009, which added profiles.prefs). Each parent's own Homie: how it looks, how Today is
-- arranged, quiet hours and the morning summary.
--
-- Choices: profiles.prefs is now written only by the server (/api/prefs validates every field and lays each change
-- in at its own path). prefs_rev counts the writes, so two devices saving at once never lose each other's change.
-- Theme shares: one parent offers a look to the other, who sees it and applies it only by choosing to.
-- Notify state: what the server already sent each parent today, so a late or repeated run never sends twice.
-- Backgrounds: a parent's own photo, private to them, written only by the server after it checked and redrew it.

alter table public.profiles add column prefs_rev bigint not null default 0;

create function public.profiles_prefs_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.prefs is distinct from old.prefs then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'prefs' using hint = 'Choices are saved through /api/prefs.';
    end if;
    if pg_column_size(new.prefs) > 16384 then raise exception 'prefs size'; end if;
    new.prefs_rev := old.prefs_rev + 1;
  elsif new.prefs_rev is distinct from old.prefs_rev then
    new.prefs_rev := old.prefs_rev;
  end if;
  return new;
end;
$$;

create trigger profiles_prefs_guard before update on public.profiles
  for each row execute function public.profiles_prefs_guard();

-- A look offered to the other parent: only appearance (theme, accent, cards, a built-in background, maybe density).
-- Never a photo, type size, accessibility, notifications or anything of the house.
create table public.theme_shares (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  look jsonb not null check (pg_column_size(look) < 2048),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answer text check (answer in ('applied', 'declined')),
  check (from_user <> to_user)
);

create index theme_shares_to on public.theme_shares (to_user) where answered_at is null;

alter table public.theme_shares enable row level security;
create policy "both parents read their shares" on public.theme_shares
  for select using (household_id = public.my_household_id() and auth.uid() in (from_user, to_user));
revoke insert, update, delete on public.theme_shares from anon, authenticated;
alter publication supabase_realtime add table public.theme_shares;

-- Offers a look to the other parent of this house. An earlier offer they haven't answered is replaced.
create function public.share_look(partner uuid, offered jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  house uuid := public.my_household_id();
  bg jsonb := coalesce(offered -> 'background', '{}'::jsonb);
  kept jsonb;
  made uuid;
begin
  if me is null or house is null then raise exception 'auth'; end if;
  if partner = me or not exists (select 1 from public.household_members where household_id = house and user_id = partner) then
    raise exception 'missing';
  end if;
  kept := jsonb_strip_nulls(jsonb_build_object(
    'theme', offered -> 'theme',
    'accent', offered -> 'accent',
    'cards', offered -> 'cards',
    'density', offered -> 'density',
    'background', case when bg ->> 'kind' is distinct from 'photo'
      then jsonb_strip_nulls(jsonb_build_object('kind', bg -> 'kind', 'gradient', bg -> 'gradient'))
    end
  ));
  delete from public.theme_shares where from_user = me and to_user = partner and answered_at is null;
  insert into public.theme_shares (household_id, from_user, to_user, look) values (house, me, partner, kept) returning id into made;
  return made;
end;
$$;

-- The receiving parent's answer. Applying happens on their device, through /api/prefs, like any other choice.
create function public.answer_look_share(share uuid, applied boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.theme_shares
  set answered_at = now(), answer = case when applied then 'applied' else 'declined' end
  where id = share and to_user = auth.uid() and household_id = public.my_household_id() and answered_at is null;
$$;

revoke all on function public.share_look(uuid, jsonb) from public;
revoke all on function public.answer_look_share(uuid, boolean) from public;
grant execute on function public.share_look(uuid, jsonb) to authenticated;
grant execute on function public.answer_look_share(uuid, boolean) to authenticated;

-- What the server already did for each parent: the day the morning summary went out, the quiet window it summed
-- up, and how far the gathered updates reach. Only the server reads or writes it.
create table public.notify_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  morning_sent_on date,
  quiet_done_until timestamptz,
  digest_until timestamptz
);
alter table public.notify_state enable row level security;
revoke all on public.notify_state from anon, authenticated;

-- backgrounds/<user>/<file>: only its owner reads or removes it. Uploads come from the server, already checked and redrawn.
create policy "parents read their own background" on storage.objects
  for select to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'backgrounds' and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "parents remove their own background" on storage.objects
  for delete to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'backgrounds' and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Who goes to an event (0010) mustn't keep their account from being deleted: the event stays, with no one named.
alter table public.events drop constraint events_attendee_id_fkey;
alter table public.events add constraint events_attendee_id_fkey
  foreign key (attendee_id) references public.profiles (id) on delete set null;

-- house_calendar() also names the calendar each event came from (a hash, not its id), for coloring by calendar.
drop function public.house_calendar(date, date);
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
  match_key text,
  calendar_key text
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
    end,
    case when c.level = 'details' then md5(c.source_id::text) end
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

revoke all on function public.house_calendar(date, date) from public;
grant execute on function public.house_calendar(date, date) to authenticated;
