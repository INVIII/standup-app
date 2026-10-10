-- schema-v4.sql - Run in Supabase SQL Editor

-- ── Teams: add timezone ───────────────────────────────────────────────────────
alter table public.teams
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- ── Checkins: add availability ───────────────────────────────────────────────
alter table public.checkins
  add column if not exists availability text not null default 'working';
-- Values: 'working' | 'half_day' | 'remote'

-- ── Projects: add completion fields ─────────────────────────────────────────
alter table public.projects
  add column if not exists completed_at timestamptz,
  add column if not exists completion_notes text;

-- ── Daily summaries: add share token ────────────────────────────────────────
alter table public.daily_summaries
  add column if not exists share_token uuid unique default gen_random_uuid();

create index if not exists daily_summaries_share_token_idx
  on public.daily_summaries (share_token);

-- ── Tasks table ──────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  team_id     uuid        not null references public.teams(id) on delete cascade,
  title       text        not null,
  description text,
  status      text        not null default 'todo',
  -- values: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority    text        not null default 'medium',
  -- values: 'low' | 'medium' | 'high'
  assigned_to uuid        references public.profiles(id) on delete set null,
  due_date    date,
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_team_id_idx on public.tasks (team_id);

alter table public.tasks enable row level security;

drop policy if exists "team members can read tasks" on public.tasks;
drop policy if exists "team admins can manage tasks" on public.tasks;

create policy "team members can read tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = tasks.team_id
    )
  );

create policy "team admins can manage tasks"
  on public.tasks for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = tasks.team_id and role = 'admin'
    )
  );

-- ── Leaves table ─────────────────────────────────────────────────────────────
create table if not exists public.leaves (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references public.profiles(id) on delete cascade,
  team_id     uuid        not null references public.teams(id) on delete cascade,
  leave_date  date        not null,
  leave_type  text        not null default 'full',
  -- values: 'full' | 'half'
  reason      text,
  marked_by   uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (profile_id, leave_date)
);

create index if not exists leaves_team_date_idx on public.leaves (team_id, leave_date);

alter table public.leaves enable row level security;

drop policy if exists "team members can read leaves" on public.leaves;
drop policy if exists "team admins can manage leaves" on public.leaves;
drop policy if exists "members can mark own leave" on public.leaves;

create policy "team members can read leaves"
  on public.leaves for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = leaves.team_id
    )
  );

create policy "team admins can manage leaves"
  on public.leaves for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = leaves.team_id and role = 'admin'
    )
  );

create policy "members can mark own leave"
  on public.leaves for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = leaves.team_id
    )
  );

-- ── Holidays table ────────────────────────────────────────────────────────────
create table if not exists public.holidays (
  id            uuid        primary key default gen_random_uuid(),
  team_id       uuid        not null references public.teams(id) on delete cascade,
  name          text        not null,
  holiday_date  date        not null,
  created_at    timestamptz not null default now(),
  unique (team_id, holiday_date)
);

create index if not exists holidays_team_date_idx on public.holidays (team_id, holiday_date);

alter table public.holidays enable row level security;

drop policy if exists "team members can read holidays" on public.holidays;
drop policy if exists "team admins can manage holidays" on public.holidays;

create policy "team members can read holidays"
  on public.holidays for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = holidays.team_id
    )
  );

create policy "team admins can manage holidays"
  on public.holidays for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and team_id = holidays.team_id and role = 'admin'
    )
  );

-- ── Share token: ensure existing rows have one ────────────────────────────────
update public.daily_summaries
  set share_token = gen_random_uuid()
  where share_token is null;
