-- KSP: notifications, email logs, panel roster, application lifecycle columns, status rename
-- Run in Supabase SQL Editor after prior application migrations.

-- ═══════════════════════════════════════════════════════════
-- 1) notifications
-- ═══════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Directors insert notifications" on public.notifications;
create policy "Directors insert notifications" on public.notifications
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

-- ═══════════════════════════════════════════════════════════
-- 2) email_logs
-- ═══════════════════════════════════════════════════════════
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  sender_director_id uuid references public.profiles(id) on delete set null,
  recipients text[] not null,
  subject text not null,
  message text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

create index if not exists idx_email_logs_sent on public.email_logs(sent_at desc);

alter table public.email_logs enable row level security;

drop policy if exists "Directors read own email logs" on public.email_logs;
create policy "Directors read own email logs" on public.email_logs
  for select using (
    sender_director_id = auth.uid() and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

drop policy if exists "Directors insert email logs" on public.email_logs;
create policy "Directors insert email logs" on public.email_logs
  for insert with check (
    sender_director_id = auth.uid() and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

-- ═══════════════════════════════════════════════════════════
-- 3) panel_members (roster for director emails; separate from auth profiles)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.panel_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  role text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_panel_members_email_lower on public.panel_members (lower(email));

alter table public.panel_members enable row level security;

drop policy if exists "Directors manage panel_members" on public.panel_members;
create policy "Directors manage panel_members" on public.panel_members
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

-- ═══════════════════════════════════════════════════════════
-- 4) applications: applicant_id + stage / interview fields
-- ═══════════════════════════════════════════════════════════
alter table public.applications add column if not exists applicant_id uuid references public.profiles(id) on delete cascade;

update public.applications set applicant_id = user_id where applicant_id is null;

create or replace function public.applications_set_applicant_id()
returns trigger as $$
begin
  if new.applicant_id is null and new.user_id is not null then
    new.applicant_id := new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_applications_applicant_id on public.applications;
create trigger trg_applications_applicant_id
  before insert or update on public.applications
  for each row execute procedure public.applications_set_applicant_id();

alter table public.applications add column if not exists stage_1_submitted_at timestamptz;
alter table public.applications add column if not exists stage_1_approved_at timestamptz;
alter table public.applications add column if not exists stage_2_submitted_at timestamptz;
alter table public.applications add column if not exists stage_2_approved_at timestamptz;

-- Rename legacy column if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'stage2_submitted_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'stage_2_submitted_at'
  ) then
    alter table public.applications rename column stage2_submitted_at to stage_2_submitted_at;
  end if;
end $$;

update public.applications set stage_1_submitted_at = coalesce(stage_1_submitted_at, submitted_at)
  where stage_1_submitted_at is null and submitted_at is not null;

alter table public.applications add column if not exists interview_date date;
alter table public.applications add column if not exists interview_time text;
alter table public.applications add column if not exists interview_location text;
alter table public.applications add column if not exists interview_instructions text;

-- ═══════════════════════════════════════════════════════════
-- 5) Status data migration → canonical names (email gate uses auth, not these)
-- ═══════════════════════════════════════════════════════════
update public.applications set status = 'stage_1_submitted' where status = 'pending';
update public.applications set status = 'stage_1_approved' where status = 'shortlisted_for_stage2';
update public.applications set status = 'called_for_interview' where status = 'interview';
update public.applications set status = 'stage_1_submitted' where status in ('stage1_submitted', 'under_review', 'review_pending');

alter table public.applications drop constraint if exists applications_status_check;

alter table public.applications add constraint applications_status_check
  check (status in (
    'draft',
    'stage_1_submitted',
    'stage_1_approved',
    'stage_2_submitted',
    'stage_2_approved',
    'called_for_interview',
    'accepted',
    'rejected'
  ));

-- Sync announcement audience values that referenced old status names
alter table public.announcements drop constraint if exists announcements_audience_check;

alter table public.announcements add constraint announcements_audience_check
  check (audience in (
    'all',
    'stage_1_submitted',
    'stage_1_approved',
    'stage_2_submitted',
    'stage_2_approved',
    'called_for_interview',
    'accepted',
    'rejected',
    'draft'
  ));

update public.announcements set audience = 'stage_1_submitted' where audience in ('pending', 'submitted', 'under_review', 'review_pending');
update public.announcements set audience = 'called_for_interview' where audience = 'interview';
update public.announcements set audience = 'stage_1_approved' where audience in ('shortlisted', 'shortlisted_for_stage2');

-- ═══════════════════════════════════════════════════════════
-- 6) Panel RLS: interview → called_for_interview
-- ═══════════════════════════════════════════════════════════
drop policy if exists "Panel can read interview applications" on public.applications;
create policy "Panel can read interview applications" on public.applications
  for select using (
    status = 'called_for_interview' and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
  );

drop policy if exists "Panel can insert own evaluations" on public.interview_evaluations;
create policy "Panel can insert own evaluations" on public.interview_evaluations
  for insert with check (
    evaluator_id = auth.uid() and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel') and
    exists (select 1 from public.applications a where a.id = application_id and a.status = 'called_for_interview')
  );

drop policy if exists "Panel can read evaluations for interview apps" on public.interview_evaluations;
create policy "Panel can read evaluations for interview apps" on public.interview_evaluations
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel') and
    exists (select 1 from public.applications a where a.id = application_id and a.status = 'called_for_interview')
  );

drop policy if exists "Panel can read applicant profiles" on public.profiles;
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
    and (id = auth.uid() or id in (select user_id from public.applications where status = 'called_for_interview'))
  );

drop policy if exists "Panel can read interview applicant uploads" on storage.objects;
create policy "Panel can read interview applicant uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications where status = 'called_for_interview'
    )
  );
