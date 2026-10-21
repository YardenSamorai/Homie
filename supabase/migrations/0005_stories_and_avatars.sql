-- Run once after 0004. Status photos that last 24 hours, who has seen them, and profile photos.
-- Files live in a private bucket: only the people of a house can open its photos.

alter table public.profiles add column avatar_path text;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  path text not null,
  caption text check (caption is null or length(caption) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index stories_household on public.stories (household_id, created_at);

alter table public.stories enable row level security;

create policy "household sees live stories" on public.stories
  for select using (household_id = public.my_household_id() and (expires_at > now() or author_id = auth.uid()));

create policy "parents post their own stories" on public.stories
  for insert with check (household_id = public.my_household_id() and author_id = auth.uid());

create policy "parents remove their own stories" on public.stories
  for delete using (author_id = auth.uid());

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.story_views enable row level security;

create policy "household sees story views" on public.story_views
  for select using (story_id in (select id from public.stories where household_id = public.my_household_id()));

create policy "parents mark what they saw" on public.story_views
  for insert with check (
    viewer_id = auth.uid() and story_id in (select id from public.stories where household_id = public.my_household_id())
  );

alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.story_views;

-- A new status photo shows up in the bell and notifies the other parent.
alter table public.activity drop constraint activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('task_added', 'task_done', 'shopping_added', 'shopping_bought', 'event_added', 'story_added'));

-- Paths: stories/<household>/<author>/<file>, avatars/<user>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('house-media', 'house-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "house reads its stories" on storage.objects
  for select to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = public.my_household_id()::text
  );

create policy "parents upload their own stories" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = public.my_household_id()::text
    and (storage.foldername(name))[3] = auth.uid()::text
  );

create policy "parents delete their own stories" on storage.objects
  for delete to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

create policy "house reads its avatars" on storage.objects
  for select to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'avatars'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (storage.foldername(name))[2] in (
        select user_id::text from public.household_members where household_id = public.my_household_id()
      )
    )
  );

create policy "parents upload their own avatar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "parents delete their own avatar" on storage.objects
  for delete to authenticated using (
    bucket_id = 'house-media' and (storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text
  );
