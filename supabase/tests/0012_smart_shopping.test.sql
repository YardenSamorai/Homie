-- Checks 0012 against a real database without leaving anything behind: run it right after the migration,
-- inside one transaction (scripts/test-sql.ps1). It always ends in an exception, which rolls everything back;
-- the message lists every check as ok/FAIL.

select set_config('test.log', '', true);

create function pg_temp.check_that(label text, ok boolean) returns void language plpgsql as $$
begin
  perform set_config('test.log', current_setting('test.log', true) || label || '=' || case when ok then 'ok' else 'FAIL' end || E'\n', true);
end;
$$;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

-- Two houses: Dana and Omer share one, Noa lives alone in the other.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dana@test.homie', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omer@test.homie', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noa@test.homie', '{}', '{}', now(), now());

insert into public.households (id, name, created_by) values
  ('00000000-0000-4000-8000-00000000aaaa', 'Test A', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000bbbb', 'Test B', '00000000-0000-4000-8000-0000000000b1');
insert into public.household_members (household_id, user_id, role, color) values
  ('00000000-0000-4000-8000-00000000aaaa', '00000000-0000-4000-8000-0000000000a1', 'admin', '#000'),
  ('00000000-0000-4000-8000-00000000aaaa', '00000000-0000-4000-8000-0000000000a2', 'member', '#000'),
  ('00000000-0000-4000-8000-00000000bbbb', '00000000-0000-4000-8000-0000000000b1', 'admin', '#000');
insert into public.events (id, household_id, title, date, created_by) values
  ('00000000-0000-4000-8000-0000000e000b', '00000000-0000-4000-8000-00000000bbbb', 'Noa party', current_date, '00000000-0000-4000-8000-0000000000b1');

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');

-- Dana: one bought, one not found, one still to buy.
insert into public.shopping_items (id, household_id, name, quantity, unit, added_by, checked_at, checked_by)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000aaaa', 'חלב', 2, 'l',
        '00000000-0000-4000-8000-0000000000a1', now(), '00000000-0000-4000-8000-0000000000a1');
insert into public.shopping_items (id, household_id, name, added_by, missing_at)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000aaaa', 'פסטו',
        '00000000-0000-4000-8000-0000000000a1', now());
insert into public.shopping_items (id, household_id, name, added_by)
values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000aaaa', 'לחם',
        '00000000-0000-4000-8000-0000000000a1');

do $$
declare
  result jsonb;
begin
  -- A link to another house's event is refused.
  begin
    insert into public.shopping_items (household_id, name, added_by, event_id)
    values ('00000000-0000-4000-8000-00000000aaaa', 'עוגה', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000e000b');
    perform pg_temp.check_that('foreign event link refused', false);
  exception when others then
    perform pg_temp.check_that('foreign event link refused', sqlstate = '23503');
  end;

  -- Finishing files the bought item, lists the one not found, leaves the rest.
  result := public.finish_shopping_trip('00000000-0000-4000-8000-00000000f001',
    array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[]);
  perform pg_temp.check_that('finish done', result->>'status' = 'done');
  perform pg_temp.check_that('finish files only bought', jsonb_array_length(result->'trip'->'items') = 1
    and result->'trip'->'items'->0->>'name' = 'חלב' and (result->'trip'->'items'->0->>'quantity')::numeric = 2);
  perform pg_temp.check_that('finish lists not found', jsonb_array_length(result->'trip'->'missing') = 1);
  perform pg_temp.check_that('bought item filed', (select trip_id from public.shopping_items where id = '00000000-0000-4000-8000-000000000001') = '00000000-0000-4000-8000-00000000f001');
  perform pg_temp.check_that('not found stays on list', (select trip_id is null and missing_at is not null from public.shopping_items where id = '00000000-0000-4000-8000-000000000002'));
  perform pg_temp.check_that('to buy stays on list', (select trip_id is null from public.shopping_items where id = '00000000-0000-4000-8000-000000000003'));

  -- A double tap or a retry with the same trip id: the same trip, not a second one.
  result := public.finish_shopping_trip('00000000-0000-4000-8000-00000000f001', array['00000000-0000-4000-8000-000000000001']::uuid[]);
  perform pg_temp.check_that('retry returns same trip', result->>'status' = 'done' and result->'trip'->>'id' = '00000000-0000-4000-8000-00000000f001');
  perform pg_temp.check_that('retry makes no new trip', (select count(*) from public.shopping_trips) = 1);
end;
$$;

-- Omer's phone finishes at the same time with its own trip id: nothing left to file.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a2');
do $$
declare
  result jsonb;
begin
  result := public.finish_shopping_trip('00000000-0000-4000-8000-00000000f002', array['00000000-0000-4000-8000-000000000001']::uuid[]);
  perform pg_temp.check_that('second phone gets empty', result->>'status' = 'empty');
  perform pg_temp.check_that('still one trip', (select count(*) from public.shopping_trips) = 1);

  -- Omer changes the filed item afterwards; undoing the trip keeps his change.
  update public.shopping_items set quantity_note = 'של תנובה' where id = '00000000-0000-4000-8000-000000000001';
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');
do $$
declare
  result jsonb;
begin
  result := public.undo_shopping_trip('00000000-0000-4000-8000-00000000f001');
  perform pg_temp.check_that('undo restores', result->>'status' = 'done' and (result->>'restored')::int = 1);
  perform pg_temp.check_that('undo keeps later change', (select trip_id is null and quantity_note = 'של תנובה' and checked_at is not null
    from public.shopping_items where id = '00000000-0000-4000-8000-000000000001'));
  result := public.undo_shopping_trip('00000000-0000-4000-8000-00000000f001');
  perform pg_temp.check_that('undo twice is harmless', result->>'status' = 'done' and (result->>'restored')::int = 0);

  -- Deleted on one phone, saved late on the other: refused, not re-created.
  delete from public.shopping_items where id = '00000000-0000-4000-8000-000000000003';
  begin
    insert into public.shopping_items (id, household_id, name, added_by)
    values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000aaaa', 'לחם', '00000000-0000-4000-8000-0000000000a1');
    perform pg_temp.check_that('deleted item not re-created', false);
  exception when others then
    perform pg_temp.check_that('deleted item not re-created', sqlstate = 'HM410');
  end;
  perform pg_temp.check_that('tombstones hidden', (select count(*) from public.shopping_item_tombstones) = 0);

  insert into public.shopping_kept_apart (household_id, pair_key) values ('00000000-0000-4000-8000-00000000aaaa', 'חלב|חלב שיבולת שועל');
  insert into public.shopping_products (household_id, item_key, staple, quantity, unit) values ('00000000-0000-4000-8000-00000000aaaa', 'חלב', true, 2, 'l');
  insert into public.shopping_groups (household_id, name, items, created_by)
  values ('00000000-0000-4000-8000-00000000aaaa', 'על האש', '[{"name":"פחמים"}]', '00000000-0000-4000-8000-0000000000a1');
end;
$$;

-- Noa, in the other house, sees none of it and can't touch it.
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');
do $$
declare
  result jsonb;
begin
  perform pg_temp.check_that('other house reads no items', (select count(*) from public.shopping_items) = 0);
  perform pg_temp.check_that('other house reads no trips', (select count(*) from public.shopping_trips) = 0);
  perform pg_temp.check_that('other house reads no products', (select count(*) from public.shopping_products) = 0);
  perform pg_temp.check_that('other house reads no groups', (select count(*) from public.shopping_groups) = 0);
  perform pg_temp.check_that('other house reads no kept apart', (select count(*) from public.shopping_kept_apart) = 0);
  result := public.finish_shopping_trip('00000000-0000-4000-8000-00000000f003', array['00000000-0000-4000-8000-000000000001']::uuid[]);
  perform pg_temp.check_that('other house cannot file items', result->>'status' = 'empty');
  begin
    perform public.finish_shopping_trip('00000000-0000-4000-8000-00000000f001', array[]::uuid[]);
    perform pg_temp.check_that('other house cannot read trip by id', false);
  exception when others then
    perform pg_temp.check_that('other house cannot read trip by id', sqlerrm = 'missing');
  end;
  result := public.undo_shopping_trip('00000000-0000-4000-8000-00000000f001');
  perform pg_temp.check_that('other house cannot undo', result->>'status' = 'missing');
  begin
    insert into public.shopping_kept_apart (household_id, pair_key) values ('00000000-0000-4000-8000-00000000aaaa', 'a|b');
    perform pg_temp.check_that('other house cannot write kept apart', false);
  exception when others then
    perform pg_temp.check_that('other house cannot write kept apart', sqlstate = '42501');
  end;
  update public.shopping_items set name = 'hacked' where id = '00000000-0000-4000-8000-000000000001';
  update public.shopping_products set staple = false where item_key = 'חלב';
end;
$$;

reset role;
do $$
begin
  perform pg_temp.check_that('foreign update had no effect', (select name = 'חלב' from public.shopping_items where id = '00000000-0000-4000-8000-000000000001')
    and (select staple from public.shopping_products where item_key = 'חלב' and household_id = '00000000-0000-4000-8000-00000000aaaa'));
  raise exception 'RESULTS%', E'\n' || current_setting('test.log', true);
end;
$$;
