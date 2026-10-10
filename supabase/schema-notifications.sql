-- ============================================================
-- STEP 1: Run this block first (no extensions needed)
-- ============================================================

-- Notifications table
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  issue_id    uuid references public.issues(id) on delete cascade,
  board_id    uuid references public.boards(id) on delete cascade,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Valid values for `type` column:
-- assigned | unassigned | mention | comment
-- due_today | due_tomorrow
-- sprint_started | sprint_completed

-- RLS
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Service role bypasses RLS — no insert policy needed
-- (API routes use the service role key)

-- Indexes
create index if not exists notifications_user_id_created_at_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read)
  where read = false;

-- Enable realtime (instant bell badge in the browser)
alter publication supabase_realtime add table public.notifications;


-- ============================================================
-- STEP 2: Enable pg_cron extension first, THEN run this block
--
-- How to enable pg_cron:
--   Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- Once enabled, run the block below to schedule daily due-date notifications
-- ============================================================

select cron.schedule(
  'due-date-notifications',
  '0 2 * * *',   -- 2:00 AM UTC = 7:30 AM IST (adjust to your team timezone)
  $$
  insert into public.notifications (user_id, type, title, issue_id, board_id)
  select
    i.assignee_id,
    case
      when i.due_date = current_date
        then 'due_today'
      else
        'due_tomorrow'
    end,
    case
      when i.due_date = current_date
        then 'Due today: ' || i.title
      else
        'Due tomorrow: ' || i.title
    end,
    i.id,
    i.board_id
  from public.issues i
  join public.workflow_statuses ws on ws.id = i.status_id
  where
    i.assignee_id is not null
    and i.due_date in (current_date, current_date + interval '1 day')
    and ws.category != 'done'
    and not exists (
      select 1 from public.notifications n
      where  n.issue_id  = i.id
        and  n.user_id   = i.assignee_id
        and  n.type      in ('due_today', 'due_tomorrow')
        and  n.created_at >= date_trunc('day', now())
    );
  $$
);
