-- Row Level Security tests. Run with scripts/test-db.sh (local PostgreSQL + auth-stub.sql).
-- Each check raises an exception on failure, which stops the run (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),  -- user A
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');  -- user B

-- Runs a statement and checks it fails with the expected SQLSTATE.
create function pg_temp.expect_error(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement succeeded, expected error %)', label, expected;
exception when others then
  if sqlstate <> expected then
    raise exception 'FAIL: % (got % "%", expected %)', label, sqlstate, sqlerrm, expected;
  end if;
  raise notice 'PASS  %', label;
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS  %', label;
end $$;

-- ---------- User A creates data ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into public.tasks (id, title, due_date) values ('11111111-1111-4111-8111-111111111111', 'A task', '2026-11-07');
insert into public.task_notes (id, task_id, body) values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'A note');
insert into public.journal_entries (id, entry_date, completed) values ('33333333-3333-4333-8333-333333333333', '2026-11-07', E'Line 1\nLine 2');
select pg_temp.check((select user_id from public.tasks) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user_id defaults to the signed-in user');
select pg_temp.check((select count(*) from public.tasks) = 1, 'A sees own task');
select pg_temp.check((select due_date::text from public.tasks) = '2026-11-07', 'due date stored as a plain calendar date');
select pg_temp.check((select completed from public.journal_entries) = E'Line 1\nLine 2', 'journal text keeps line breaks');
select pg_temp.expect_error($$insert into public.journal_entries (id, entry_date) values (gen_random_uuid(), '2026-11-07')$$, '23505', 'only one journal entry per date');
select pg_temp.expect_error($$insert into public.tasks (id, title) values (gen_random_uuid(), '   ')$$, '23514', 'blank title rejected');
select pg_temp.expect_error($$insert into public.tasks (id, title, status) values (gen_random_uuid(), 'x', 'someday')$$, '23514', 'invalid status rejected');
commit;

-- ---------- User B cannot touch A's data ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select pg_temp.check((select count(*) from public.tasks) = 0, 'B cannot see A''s tasks');
select pg_temp.check((select count(*) from public.task_notes) = 0, 'B cannot see A''s notes');
select pg_temp.check((select count(*) from public.journal_entries) = 0, 'B cannot see A''s journal');
update public.tasks set title = 'hacked';
delete from public.tasks;
update public.journal_entries set completed = 'hacked';
delete from public.journal_entries;
select pg_temp.expect_error($$insert into public.tasks (id, user_id, title) values (gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'planted')$$, '42501', 'B cannot create a task owned by A');
select pg_temp.expect_error($$insert into public.task_notes (id, task_id, body) values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'planted')$$, '23503', 'B cannot attach a note to A''s task');
-- B's own data works, including the same journal date as A.
insert into public.journal_entries (id, entry_date) values (gen_random_uuid(), '2026-11-07');
select pg_temp.check((select count(*) from public.journal_entries) = 1, 'B can keep a journal entry for the same date');
commit;

-- ---------- A's data survived B's attempts ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select pg_temp.check((select title from public.tasks) = 'A task', 'B''s update did not change A''s task');
select pg_temp.check((select completed from public.journal_entries) = E'Line 1\nLine 2', 'B''s update did not change A''s journal');
select pg_temp.check((select count(*) from public.task_notes) = 1, 'B''s delete did not remove A''s data');
select pg_temp.expect_error($$update public.tasks set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$, '42501', 'A cannot hand a task to another user');
commit;

-- ---------- Signed-out visitors ----------
begin;
set local role anon;
select pg_temp.expect_error($$select * from public.tasks$$, '42501', 'signed-out visitor cannot read tasks');
select pg_temp.expect_error($$select * from public.journal_entries$$, '42501', 'signed-out visitor cannot read journal');
select pg_temp.expect_error($$insert into public.tasks (id, title) values (gen_random_uuid(), 'x')$$, '42501', 'signed-out visitor cannot add tasks');
commit;

-- ---------- Deleting a task removes its notes ----------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.tasks where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.check((select count(*) from public.task_notes) = 0, 'deleting a task deletes its notes');
commit;

\echo 'All RLS checks passed.'
