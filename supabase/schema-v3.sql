-- Run this in Supabase SQL Editor

-- Allow admins to update their own team's name
create policy "admins can update their team"
  on public.teams
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and team_id = teams.id
        and role = 'admin'
    )
  );


create table if not exists public.summary_qa (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references public.teams(id) on delete cascade,
  summary_date date       not null,
  question    text        not null,
  answer      text        not null,
  asked_by    uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists summary_qa_team_date_idx
  on public.summary_qa (team_id, summary_date, created_at);

alter table public.summary_qa enable row level security;

drop policy if exists "team admins can manage qa" on public.summary_qa;

-- Admins of the team can read and write Q&A for their team
create policy "team admins can manage qa"
  on public.summary_qa
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and team_id = summary_qa.team_id
        and role = 'admin'
    )
  );

drop policy if exists "admins can update their team" on public.teams;

