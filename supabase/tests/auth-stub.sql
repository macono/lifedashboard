-- LOCAL TESTING ONLY. Recreates the small part of Supabase that the migration
-- depends on (roles, auth.users, auth.uid()) so it can run on plain PostgreSQL.
-- Never run this against a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
