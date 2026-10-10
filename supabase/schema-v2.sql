-- ── Schema v2 additions ─────────────────────────────────────────────
-- Run this in Supabase SQL Editor AFTER the original schema.sql

-- ── 1. Extend projects table ────────────────────────────────────────
alter table public.projects
  add column if not exists status text not null default 'active'
    check (status in ('backlog','active','qa','staging','production','on_hold','done')),
  add column if not exists priority text not null default 'medium'
    check (priority in ('low','medium','high','critical')),
  add column if not exists start_date date,
  add column if not exists end_date date;

-- ── 2. Milestones ───────────────────────────────────────────────────
create table if not exists public.milestones (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  team_id     uuid        not null references public.teams(id) on delete cascade,
  title       text        not null,
  is_done     boolean     not null default false,
  done_at     timestamptz,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.milestones enable row level security;

drop policy if exists "milestones_select" on public.milestones;
drop policy if exists "milestones_insert" on public.milestones;
drop policy if exists "milestones_update" on public.milestones;
drop policy if exists "milestones_delete" on public.milestones;

create policy "milestones_select" on public.milestones
  for select using (auth.role() = 'authenticated');
create policy "milestones_insert" on public.milestones
  for insert with check (auth.role() = 'authenticated');
create policy "milestones_update" on public.milestones
  for update using (auth.role() = 'authenticated');
create policy "milestones_delete" on public.milestones
  for delete using (auth.role() = 'authenticated');

-- ── 3. Invites ──────────────────────────────────────────────────────
create table if not exists public.invites (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references public.teams(id) on delete cascade,
  email       text,       -- null = open invite link (anyone with token can join)
  invited_by  uuid        references public.profiles(id),
  token       text        unique not null default encode(gen_random_bytes(24), 'hex'),
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

alter table public.invites enable row level security;

drop policy if exists "invites_select" on public.invites;
drop policy if exists "invites_insert" on public.invites;
drop policy if exists "invites_update" on public.invites;

-- Anyone can read an invite by token (needed for join page)
create policy "invites_select" on public.invites
  for select using (true);

-- Only authenticated users can create invites
create policy "invites_insert" on public.invites
  for insert with check (auth.role() = 'authenticated');

-- Anyone can mark invite as used (needed when dev joins)
create policy "invites_update" on public.invites
  for update using (true);
