-- Who is going to an event, and a photo on a shopping item so the other parent
-- can see the exact product. Photos live in the private house-media bucket:
-- shopping/<household>/<file>.jpg

alter table public.events
  add column attendee_id uuid references public.profiles (id);

alter table public.shopping_items
  add column photo_path text;

create policy "house reads shopping photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'house-media'
    and (storage.foldername(name))[1] = 'shopping'
    and (storage.foldername(name))[2] = public.my_household_id()::text
  );

create policy "parents upload shopping photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'house-media'
    and (storage.foldername(name))[1] = 'shopping'
    and (storage.foldername(name))[2] = public.my_household_id()::text
  );

create policy "parents delete shopping photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'house-media'
    and (storage.foldername(name))[1] = 'shopping'
    and (storage.foldername(name))[2] = public.my_household_id()::text
  );
