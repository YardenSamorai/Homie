-- Run once after 0007. Profile photos load instantly: a public bucket with unguessable file names
-- (<user>/<random>.jpg), cached by the phone for a year; a new photo gets a new name.
-- Status photos stay in the private house-media bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "parents upload their own photo" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "parents delete their own photo" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- The invite shows who's inviting: their name and now their photo.
create or replace function public.preview_invite(invite_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite public.household_invites%rowtype;
  house_name text;
  inviter text;
  inviter_photo text;
  members integer;
  status text := 'ok';
begin
  select * into invite from public.household_invites where token = invite_token;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  select name into house_name from public.households where id = invite.household_id;
  select display_name, avatar_path into inviter, inviter_photo from public.profiles where id = invite.created_by;
  select count(*) into members from public.household_members where household_id = invite.household_id;
  if invite.revoked_at is not null then
    status := 'revoked';
  elsif invite.accepted_by is not null then
    status := 'used';
  elsif invite.expires_at < now() then
    status := 'expired';
  elsif members >= 2 then
    status := 'full';
  end if;
  return jsonb_build_object(
    'status', status,
    'household_id', case when status in ('ok', 'full') then invite.household_id else null end,
    'household_name', case when status in ('ok', 'full') then house_name else null end,
    'inviter_name', case when status = 'ok' then inviter else null end,
    'inviter_photo', case when status = 'ok' then inviter_photo else null end,
    'expires_at', case when status = 'ok' then invite.expires_at else null end
  );
end;
$$;

revoke all on function public.preview_invite(text) from public;
grant execute on function public.preview_invite(text) to anon, authenticated;
