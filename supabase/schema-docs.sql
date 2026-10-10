-- ─────────────────────────────────────────────────────────────────────────────
-- Documentation feature: team-level folders / subfolders + documentation links.
-- Additive only — safe to run on an existing database.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.doc_folders (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  parent_id   uuid references public.doc_folders(id) on delete cascade,  -- null = root
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.doc_links (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  folder_id    uuid references public.doc_folders(id) on delete cascade, -- null = root level
  title        text not null,
  url          text not null,
  description  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists doc_folders_team_idx  on public.doc_folders(team_id);
create index if not exists doc_folders_parent_idx on public.doc_folders(parent_id);
create index if not exists doc_links_team_idx     on public.doc_links(team_id);
create index if not exists doc_links_folder_idx   on public.doc_links(folder_id);

alter table public.doc_folders enable row level security;
alter table public.doc_links   enable row level security;

-- ── doc_folders policies ──────────────────────────────────────────────
drop policy if exists "doc_folders_select" on public.doc_folders;
drop policy if exists "doc_folders_insert" on public.doc_folders;
drop policy if exists "doc_folders_update" on public.doc_folders;
drop policy if exists "doc_folders_delete" on public.doc_folders;

create policy "doc_folders_select" on public.doc_folders for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_folders.team_id)
);
create policy "doc_folders_insert" on public.doc_folders for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_folders.team_id)
);
create policy "doc_folders_update" on public.doc_folders for update using (
  created_by = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_folders.team_id and role = 'admin')
);
create policy "doc_folders_delete" on public.doc_folders for delete using (
  created_by = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_folders.team_id and role = 'admin')
);

-- ── doc_links policies ────────────────────────────────────────────────
drop policy if exists "doc_links_select" on public.doc_links;
drop policy if exists "doc_links_insert" on public.doc_links;
drop policy if exists "doc_links_update" on public.doc_links;
drop policy if exists "doc_links_delete" on public.doc_links;

create policy "doc_links_select" on public.doc_links for select using (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_links.team_id)
);
create policy "doc_links_insert" on public.doc_links for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_links.team_id)
);
create policy "doc_links_update" on public.doc_links for update using (
  created_by = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_links.team_id and role = 'admin')
);
create policy "doc_links_delete" on public.doc_links for delete using (
  created_by = auth.uid() or
  exists (select 1 from public.profiles where id = auth.uid() and team_id = doc_links.team_id and role = 'admin')
);
