// Dựng Postgres trong bộ nhớ (PGlite) giả lập phần Supabase (auth, role, storage) rồi chạy mọi migration.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function newDb({ seed = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth to anon, authenticated;
    grant select on auth.users to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  const run = async (folder) => {
    const dir = fileURLToPath(new URL(`../${folder}/`, import.meta.url));
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await db.exec(readFileSync(dir + f, "utf8"));
  };
  await run("migrations");
  if (seed) await run("seed");
  return db;
}
