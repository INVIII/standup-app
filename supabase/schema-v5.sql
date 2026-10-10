-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v5 - Jira-replacement: boards, workflow, sprints, issues, comments,
--             attachments, releases
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Boards (Jira "Projects") ──────────────────────────────────────────────────
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  key         text not null,           -- e.g. "UPLVYL", "DESIGN"
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (team_id, key)
);

-- ── Workflow statuses (per board, fully customizable) ─────────────────────────
create table if not exists public.workflow_statuses (
  id       uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  team_id  uuid not null references public.teams(id) on delete cascade,
  name     text not null,
  color    text not null default '#6b6b6b',
  category text not null default 'todo',  -- todo | in_progress | done
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Sprints ───────────────────────────────────────────────────────────────────
create table if not exists public.sprints (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null,
  goal       text,
  status     text not null default 'planning',  -- planning | active | completed
  start_date date,
  end_date   date,
  created_at timestamptz not null default now()
);

-- ── Issues ────────────────────────────────────────────────────────────────────
create table if not exists public.issues (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  issue_number integer not null,         -- auto-assigned per board: UPLVYL-1, UPLVYL-2…
  type         text not null default 'task',  -- epic | story | bug | task | subtask
  title        text not null,
  description  text,                     -- markdown
  status_id    uuid references public.workflow_statuses(id) on delete set null,
  priority     text not null default 'medium',  -- urgent | high | medium | low | no_priority
  assignee_id  uuid references public.profiles(id) on delete set null,
  reporter_id  uuid references public.profiles(id) on delete set null,
  parent_id    uuid references public.issues(id) on delete cascade,  -- subtasks / stories under epics
  sprint_id    uuid references public.sprints(id) on delete set null,  -- null = backlog
  story_points numeric,
  start_date   date,
  due_date     date,
  rank         text not null default '',  -- for manual ordering
  labels       text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (board_id, issue_number)
);

-- auto-increment issue_number per board
create or replace function public.next_issue_number(p_board_id uuid)
returns integer language sql as $$
  select coalesce(max(issue_number), 0) + 1 from public.issues where board_id = p_board_id;
$$;

create or replace function public.set_issue_number()
returns trigger language plpgsql as $$
begin
  if new.issue_number is null or new.issue_number = 0 then
    new.issue_number := public.next_issue_number(new.board_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_issue_number on public.issues;
create trigger trg_set_issue_number
  before insert on public.issues
  for each row execute procedure public.set_issue_number();

-- ── Comments ──────────────────────────────────────────────────────────────────
create table if not exists public.issue_comments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references public.issues(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  team_id    uuid not null references public.teams(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Attachments ───────────────────────────────────────────────────────────────
create table if not exists public.issue_attachments (
  id        uuid primary key default gen_random_uuid(),
  issue_id  uuid not null references public.issues(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete set null,
  team_id   uuid not null references public.teams(id) on delete cascade,
  file_name text not null,
  file_url  text not null,
  file_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

-- ── Releases ──────────────────────────────────────────────────────────────────
create table if not exists public.releases (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  name         text not null,
  version      text,
  description  text,
  status       text not null default 'unreleased',  -- unreleased | released | archived
  release_date date,
  created_at   timestamptz not null default now()
);

create table if not exists public.release_issues (
  release_id uuid not null references public.releases(id) on delete cascade,
  issue_id   uuid not null references public.issues(id) on delete cascade,
  primary key (release_id, issue_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.boards             enable row level security;
alter table public.workflow_statuses  enable row level security;
alter table public.sprints            enable row level security;
alter table public.issues             enable row level security;
alter table public.issue_comments     enable row level security;
alter table public.issue_attachments  enable row level security;
alter table public.releases           enable row level security;
alter table public.release_issues     enable row level security;

-- boards
drop policy if exists "boards_select" on public.boards;
drop policy if exists "boards_insert" on public.boards;
drop policy if exists "boards_update" on public.boards;
drop policy if exists "boards_delete" on public.boards;
create policy "boards_select" on public.boards for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = boards.team_id)
);
create policy "boards_insert" on public.boards for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = boards.team_id and role = 'admin')
);
create policy "boards_update" on public.boards for update using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = boards.team_id and role = 'admin')
);
create policy "boards_delete" on public.boards for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = boards.team_id and role = 'admin')
);

-- workflow_statuses
drop policy if exists "wf_select" on public.workflow_statuses;
drop policy if exists "wf_insert" on public.workflow_statuses;
drop policy if exists "wf_update" on public.workflow_statuses;
drop policy if exists "wf_delete" on public.workflow_statuses;
create policy "wf_select" on public.workflow_statuses for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = workflow_statuses.team_id)
);
create policy "wf_insert" on public.workflow_statuses for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = workflow_statuses.team_id and role = 'admin')
);
create policy "wf_update" on public.workflow_statuses for update using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = workflow_statuses.team_id and role = 'admin')
);
create policy "wf_delete" on public.workflow_statuses for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = workflow_statuses.team_id and role = 'admin')
);

-- sprints
drop policy if exists "sprints_select" on public.sprints;
drop policy if exists "sprints_insert" on public.sprints;
drop policy if exists "sprints_update" on public.sprints;
drop policy if exists "sprints_delete" on public.sprints;
create policy "sprints_select" on public.sprints for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = sprints.team_id)
);
create policy "sprints_insert" on public.sprints for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = sprints.team_id and role = 'admin')
);
create policy "sprints_update" on public.sprints for update using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = sprints.team_id)
);
create policy "sprints_delete" on public.sprints for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = sprints.team_id and role = 'admin')
);

-- issues - all team members can CRUD
drop policy if exists "issues_select" on public.issues;
drop policy if exists "issues_insert" on public.issues;
drop policy if exists "issues_update" on public.issues;
drop policy if exists "issues_delete" on public.issues;
create policy "issues_select" on public.issues for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issues.team_id)
);
create policy "issues_insert" on public.issues for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issues.team_id)
);
create policy "issues_update" on public.issues for update using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issues.team_id)
);
create policy "issues_delete" on public.issues for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issues.team_id)
);

-- comments
drop policy if exists "comments_select" on public.issue_comments;
drop policy if exists "comments_insert" on public.issue_comments;
drop policy if exists "comments_update" on public.issue_comments;
drop policy if exists "comments_delete" on public.issue_comments;
create policy "comments_select" on public.issue_comments for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_comments.team_id)
);
create policy "comments_insert" on public.issue_comments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_comments.team_id)
);
create policy "comments_update" on public.issue_comments for update using (user_id = auth.uid());
create policy "comments_delete" on public.issue_comments for delete using (
  user_id = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_comments.team_id and role = 'admin')
);

-- attachments
drop policy if exists "attach_select" on public.issue_attachments;
drop policy if exists "attach_insert" on public.issue_attachments;
drop policy if exists "attach_delete" on public.issue_attachments;
create policy "attach_select" on public.issue_attachments for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_attachments.team_id)
);
create policy "attach_insert" on public.issue_attachments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_attachments.team_id)
);
create policy "attach_delete" on public.issue_attachments for delete using (
  user_id = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = issue_attachments.team_id and role = 'admin')
);

-- releases
drop policy if exists "releases_select" on public.releases;
drop policy if exists "releases_insert" on public.releases;
drop policy if exists "releases_update" on public.releases;
drop policy if exists "releases_delete" on public.releases;
create policy "releases_select" on public.releases for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = releases.team_id)
);
create policy "releases_insert" on public.releases for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = releases.team_id and role = 'admin')
);
create policy "releases_update" on public.releases for update using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = releases.team_id and role = 'admin')
);
create policy "releases_delete" on public.releases for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = releases.team_id and role = 'admin')
);

drop policy if exists "ri_select" on public.release_issues;
drop policy if exists "ri_insert" on public.release_issues;
drop policy if exists "ri_delete" on public.release_issues;
create policy "ri_select" on public.release_issues for select using (true);
create policy "ri_insert" on public.release_issues for insert with check (true);
create policy "ri_delete" on public.release_issues for delete using (true);

-- ── Storage bucket for attachments ────────────────────────────────────────────
-- Run separately in Supabase Storage dashboard:
-- Create a bucket named "issue-attachments" (private, 10MB limit per file)
