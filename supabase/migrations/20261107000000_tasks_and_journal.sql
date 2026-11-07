-- Life Dashboard: first real tables.
-- Every row belongs to one user (user_id). Row Level Security allows each signed-in
-- user to read and change only their own rows. Signed-out visitors get nothing.

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  description   text not null default '',
  due_date      date,                                   -- local calendar date, no time zone
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'done')),
  waiting_on    text not null default '',
  is_example    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  -- Lets task_notes prove each note belongs to a task owned by the same user.
  unique (id, user_id)
);

create index tasks_user_id_idx on public.tasks (user_id);

-- ---------------------------------------------------------------------------
-- Progress notes on tasks
-- ---------------------------------------------------------------------------
create table public.task_notes (
  id          uuid primary key,
  task_id     uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) > 0),
  created_at  timestamptz not null default now(),
  -- A note can only point at a task owned by the same user; deleting the task deletes its notes.
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_notes_task_id_idx on public.task_notes (task_id);
create index task_notes_user_id_idx on public.task_notes (user_id);

-- ---------------------------------------------------------------------------
-- Daily journal: one entry per user per calendar date, eight sections
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date        date not null,
  completed         text not null default '',
  where_i_went      text not null default '',
  what_i_learned    text not null default '',
  what_i_ate        text not null default '',
  exercises         text not null default '',
  new_action_items  text not null default '',
  flock_plan        text not null default '',
  random_thoughts   text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only access
-- ((select auth.uid()) is evaluated once per query, as Supabase recommends.)
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;
alter table public.journal_entries enable row level security;

create policy "Owners can read their tasks" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can add tasks" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can update their tasks" on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners can delete their tasks" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Owners can read their notes" on public.task_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can add notes" on public.task_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can delete their notes" on public.task_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Owners can read their journal" on public.journal_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can add journal entries" on public.journal_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can update their journal" on public.journal_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners can delete their journal" on public.journal_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Table permissions: signed-in users only (RLS above narrows to their own rows).
-- Explicit so behavior doesn't depend on the project's default grants.
-- ---------------------------------------------------------------------------
revoke all on public.tasks, public.task_notes, public.journal_entries from anon;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, delete on public.task_notes to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
