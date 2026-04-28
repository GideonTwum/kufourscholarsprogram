-- Kufuor Scholars — consolidated features migration (run in Supabase SQL editor)
-- Status: pending replaces stage1_submitted / under_review / review_pending for review queue

-- ═══════════════════════════════════════════════════════════
-- Applications: rejection reason + simplified review status
-- ═══════════════════════════════════════════════════════════
alter table public.applications add column if not exists rejection_reason text;

update public.applications
set status = 'pending'
where status in ('stage1_submitted', 'under_review', 'review_pending');

alter table public.applications drop constraint if exists applications_status_check;

alter table public.applications add constraint applications_status_check
  check (status in (
    'draft',
    'pending',
    'rejected',
    'shortlisted_for_stage2',
    'stage2_submitted',
    'interview',
    'accepted'
  ));

-- ═══════════════════════════════════════════════════════════
-- Scholars: profile fields for directory / CRM
-- ═══════════════════════════════════════════════════════════
alter table public.scholars add column if not exists occupation text;
alter table public.scholars add column if not exists email text;
alter table public.scholars add column if not exists school text;

comment on column public.scholars.school is 'Institution label (may mirror university)';
comment on column public.scholars.occupation is 'Current role / occupation';
comment on column public.scholars.email is 'Optional public or contact email for directory';

-- ═══════════════════════════════════════════════════════════
-- YouTube spotlights (homepage / program videos)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.youtube_spotlights (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  youtube_url text not null,
  description text,
  display_order int default 0,
  is_published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

update public.announcements set audience = 'pending' where audience = 'under_review';

alter table public.youtube_spotlights enable row level security;

create policy "Anyone can read published youtube spotlights"
  on public.youtube_spotlights for select
  using (is_published = true);

create policy "Directors can manage youtube spotlights"
  on public.youtube_spotlights for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );
