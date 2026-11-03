import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/** The pieces of a Supabase project the migrations lean on: auth, storage, roles, the realtime publication. */
const platform = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const migrations = join(__dirname, "..", "migrations");

/** A fresh database with every migration applied, in order. */
export async function freshDatabase(upTo?: string) {
  const db = new PGlite();
  await db.exec(platform);
  const files = readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    if (upTo && file > upTo) break;
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Runs `work` as a signed-in user (RLS applies), like a browser holding that person's session. */
export async function asUser<T>(db: PGlite, userId: string, work: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await work();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Two parents sharing a house, plus a stranger in another house. */
export async function seedHouses(db: PGlite) {
  const ids = {
    a: "00000000-0000-4000-8000-00000000000a",
    b: "00000000-0000-4000-8000-00000000000b",
    c: "00000000-0000-4000-8000-00000000000c",
    house: "10000000-0000-4000-8000-000000000001",
    other: "10000000-0000-4000-8000-000000000002",
  };
  await db.exec(`
    insert into auth.users (id, email) values ('${ids.a}', 'a@example.com'), ('${ids.b}', 'b@example.com'), ('${ids.c}', 'c@example.com');
    insert into public.households (id, name, created_by) values ('${ids.house}', 'Home', '${ids.a}'), ('${ids.other}', 'Other', '${ids.c}');
    insert into public.household_members (household_id, user_id, role, color) values
      ('${ids.house}', '${ids.a}', 'admin', 'sage'), ('${ids.house}', '${ids.b}', 'member', 'clay'), ('${ids.other}', '${ids.c}', 'admin', 'sage');
  `);
  return ids;
}
