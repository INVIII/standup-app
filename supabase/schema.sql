-- ── Teams ──────────────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- ── Profiles (extends Supabase auth.users) ──────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'member',
  avatar_color text default '#5e6ad2',
  team_id uuid references teams(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── Projects ────────────────────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text default '#5e6ad2',
  team_id uuid references teams(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── Morning check-ins (SOD) ──────────────────────────────────────────
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  team_id uuid references teams(id),
  project_id uuid references projects(id),
  todos text not null,
  blockers text,
  checkin_date date not null default current_date,
  submitted_at timestamptz default now(),
  unique(user_id, checkin_date)
);

-- ── EOD updates ─────────────────────────────────────────────────────
create table if not exists eod_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  team_id uuid references teams(id),
  checkin_id uuid references checkins(id),
  accomplished text not null,
  pending text,
  status text not null default 'partial',
  eod_date date not null default current_date,
  submitted_at timestamptz default now(),
  unique(user_id, eod_date)
);

-- ── AI daily summaries (cached) ─────────────────────────────────────
create table if not exists daily_summaries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id),
  summary_date date not null,
  summary_text text not null,
  insights jsonb,
  generated_at timestamptz default now(),
  unique(team_id, summary_date)
);

-- ────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table teams enable row level security;
alter table projects enable row level security;
alter table checkins enable row level security;
alter table eod_updates enable row level security;
alter table daily_summaries enable row level security;

-- Drop existing policies before recreating (safe re-run)
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "teams_select" on teams;
drop policy if exists "teams_insert" on teams;
drop policy if exists "teams_update" on teams;
drop policy if exists "projects_select" on projects;
drop policy if exists "projects_insert" on projects;
drop policy if exists "projects_update" on projects;
drop policy if exists "projects_delete" on projects;
drop policy if exists "checkins_select" on checkins;
drop policy if exists "checkins_insert" on checkins;
drop policy if exists "checkins_update" on checkins;
drop policy if exists "eod_select" on eod_updates;
drop policy if exists "eod_insert" on eod_updates;
drop policy if exists "eod_update" on eod_updates;
drop policy if exists "summary_select" on daily_summaries;
drop policy if exists "summary_insert" on daily_summaries;
drop policy if exists "summary_update" on daily_summaries;
drop policy if exists "summary_delete" on daily_summaries;

-- profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- teams
create policy "teams_select" on teams for select using (auth.role() = 'authenticated');
create policy "teams_insert" on teams for insert with check (auth.role() = 'authenticated');
create policy "teams_update" on teams for update using (auth.role() = 'authenticated');

-- projects
create policy "projects_select" on projects for select using (auth.role() = 'authenticated');
create policy "projects_insert" on projects for insert with check (auth.role() = 'authenticated');
create policy "projects_update" on projects for update using (auth.role() = 'authenticated');
create policy "projects_delete" on projects for delete using (auth.role() = 'authenticated');

-- checkins
create policy "checkins_select" on checkins for select using (auth.role() = 'authenticated');
create policy "checkins_insert" on checkins for insert with check (auth.uid() = user_id);
create policy "checkins_update" on checkins for update using (auth.uid() = user_id);

-- eod_updates
create policy "eod_select" on eod_updates for select using (auth.role() = 'authenticated');
create policy "eod_insert" on eod_updates for insert with check (auth.uid() = user_id);
create policy "eod_update" on eod_updates for update using (auth.uid() = user_id);

-- daily_summaries
create policy "summary_select" on daily_summaries for select using (auth.role() = 'authenticated');
create policy "summary_insert" on daily_summaries for insert with check (auth.role() = 'service_role');
create policy "summary_update" on daily_summaries for update using (auth.role() = 'service_role');
create policy "summary_delete" on daily_summaries for delete using (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────
-- Auto-create profile on first sign-in (fixed: handles null email)
-- ────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  _email text;
  _name  text;
begin
  _email := coalesce(new.email, new.id::text);
  _name  := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(_email, '@', 1),
    'User'
  );

  insert into public.profiles (id, email, name)
  values (new.id, _email, _name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
