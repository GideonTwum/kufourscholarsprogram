-- =============================================================================
-- KSP — SINGLE CATCH-UP MIGRATION (idempotent where possible)
-- Run once in Supabase SQL Editor AFTER base migrations (profiles, applications).
--
-- Ensures aligned with current app: is_director() RLS helpers, canonical
-- application statuses, notifications, email_logs, panel_members,
-- interview_slots + interview_slot_id, applications bucket policies, trigger.
-- =============================================================================

begin;

-- ═══════════════════════════════════════════════════════════════
-- A) SECURITY DEFINER: director checks (avoid profiles RLS recursion)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.is_director()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'director'
  );
$$;

create or replace function public.is_panel()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'panel'
  );
$$;

-- ═══════════════════════════════════════════════════════════════
-- B) profiles: roles + SELECT/UPDATE policies using is_director()
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('scholar', 'director', 'pending', 'applicant', 'panel'));

drop policy if exists "Directors can read all profiles" on public.profiles;
create policy "Directors can read all profiles" on public.profiles
  for select using (public.is_director());

drop policy if exists "Directors can update any profile" on public.profiles;
create policy "Directors can update any profile" on public.profiles
  for update using (public.is_director());

drop policy if exists "Authenticated can read director profiles" on public.profiles;
create policy "Authenticated can read director profiles" on public.profiles
  for select using (auth.uid() is not null and role = 'director');

-- Panel applicant visibility (evaluation flow)
drop policy if exists "Panel can read applicant profiles" on public.profiles;
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    public.is_panel()
    and (
      id = auth.uid()
      or id in (select user_id from public.applications where status = 'called_for_interview')
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- C) applications bucket + director/panel-ish storage policies (is_director)
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('applications', 'applications', false)
on conflict (id) do nothing;

drop policy if exists "Directors can read all uploads" on storage.objects;
create policy "Directors can read all uploads" on storage.objects
  for select using (
    bucket_id = 'applications' and public.is_director()
  );

drop policy if exists "Users can upload to own folder" on storage.objects;
create policy "Users can upload to own folder" on storage.objects
  for insert with check (
    bucket_id = 'applications' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own uploads" on storage.objects;
create policy "Users can read own uploads" on storage.objects
  for select using (
    bucket_id = 'applications' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Panel can read interview applicant uploads" on storage.objects;
create policy "Panel can read interview applicant uploads" on storage.objects
  for select using (
    bucket_id = 'applications'
    and public.is_panel()
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications where status = 'called_for_interview'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- D) interview_slots + FK on applications
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.interview_slots (
  id uuid default gen_random_uuid() primary key,
  director_id uuid references public.profiles(id) on delete cascade not null,
  batch_name text not null,
  interview_date date not null,
  interview_time text not null,
  location text not null,
  congratulations_message text,
  created_at timestamptz default now()
);

alter table public.interview_slots enable row level security;

alter table public.applications add column if not exists interview_slot_id uuid references public.interview_slots(id) on delete set null;

drop policy if exists "Directors can manage interview slots" on public.interview_slots;
create policy "Directors can manage interview slots" on public.interview_slots
  for all using (public.is_director());

drop policy if exists "Applicants can read own interview slot" on public.interview_slots;
create policy "Applicants can read own interview slot" on public.interview_slots
  for select using (
    exists (
      select 1 from public.applications a
      where a.interview_slot_id = id and a.user_id = auth.uid()
    )
  );

drop policy if exists "Directors can read all applications" on public.applications;
create policy "Directors can read all applications" on public.applications
  for select using (public.is_director());

drop policy if exists "Directors can update applications" on public.applications;
create policy "Directors can update applications" on public.applications
  for update using (public.is_director());

-- ═══════════════════════════════════════════════════════════════
-- E) notifications + email_logs + panel_members
-- ═══════════════════════════════════════════════════════════════
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
  for insert with check (public.is_director());

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
    sender_director_id = auth.uid() and public.is_director()
  );

drop policy if exists "Directors insert email logs" on public.email_logs;
create policy "Directors insert email logs" on public.email_logs
  for insert with check (
    sender_director_id = auth.uid() and public.is_director()
  );

create table if not exists public.panel_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  role text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_panel_members_email_lower on public.panel_members(lower(email));

alter table public.panel_members enable row level security;

drop policy if exists "Directors manage panel_members" on public.panel_members;
create policy "Directors manage panel_members" on public.panel_members
  for all using (public.is_director())
  with check (public.is_director());

-- ═══════════════════════════════════════════════════════════════
-- F) applications lifecycle columns + applicant_id sync trigger
-- ═══════════════════════════════════════════════════════════════
alter table public.applications add column if not exists rejection_reason text;
alter table public.applications add column if not exists applicant_id uuid references public.profiles(id) on delete cascade;

update public.applications set applicant_id = user_id where applicant_id is null and user_id is not null;

create or replace function public.applications_set_applicant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.applicant_id is null and new.user_id is not null then
    new.applicant_id := new.user_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_applications_applicant_id on public.applications;
create trigger trg_applications_applicant_id
  before insert or update on public.applications
  for each row execute function public.applications_set_applicant_id();

alter table public.applications add column if not exists stage_1_submitted_at timestamptz;
alter table public.applications add column if not exists stage_1_approved_at timestamptz;
alter table public.applications add column if not exists stage_2_submitted_at timestamptz;
alter table public.applications add column if not exists stage_2_approved_at timestamptz;

do $do$
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
end $do$;

update public.applications set stage_1_submitted_at = coalesce(stage_1_submitted_at, submitted_at)
where stage_1_submitted_at is null and submitted_at is not null;

alter table public.applications add column if not exists interview_date date;
alter table public.applications add column if not exists interview_time text;
alter table public.applications add column if not exists interview_location text;
alter table public.applications add column if not exists interview_instructions text;

-- ═══════════════════════════════════════════════════════════════
-- G) Migrate legacy status values → canonical (matches app routes)
-- ═══════════════════════════════════════════════════════════════
update public.applications set status = 'stage_1_submitted' where status = 'pending';
update public.applications set status = 'stage_1_approved' where status = 'shortlisted_for_stage2';
update public.applications set status = 'called_for_interview' where status = 'interview';
update public.applications set status = 'stage_2_submitted' where status = 'stage2_submitted';
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

-- ═══════════════════════════════════════════════════════════════
-- H) announcements audience: drop CHECK → normalize → re-add CHECK
-- ═══════════════════════════════════════════════════════════════
alter table public.announcements drop constraint if exists announcements_audience_check;

update public.announcements set audience = 'stage_1_submitted'
  where audience in ('pending', 'submitted', 'under_review', 'review_pending');
update public.announcements set audience = 'called_for_interview' where audience = 'interview';
update public.announcements set audience = 'stage_1_approved'
  where audience in ('shortlisted', 'shortlisted_for_stage2');

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

-- ═══════════════════════════════════════════════════════════════
-- I) interview_evaluations + director access (is_director)
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.interview_evaluations (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  evaluator_id uuid references public.profiles(id) on delete set null,
  appearance_personality smallint check (appearance_personality between 1 and 5),
  leadership_qualities smallint check (leadership_qualities between 1 and 5),
  writing_skills smallint check (writing_skills between 1 and 5),
  global_orientation smallint check (global_orientation between 1 and 5),
  inter_personal_skills smallint check (inter_personal_skills between 1 and 5),
  communication_skills smallint check (communication_skills between 1 and 5),
  initiative smallint check (initiative between 1 and 5),
  integrity smallint check (integrity between 1 and 5),
  patriotism smallint check (patriotism between 1 and 5),
  total_weighted_score numeric(5,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_interview_evaluations_application on public.interview_evaluations(application_id);

alter table public.interview_evaluations enable row level security;

drop policy if exists "Directors can manage interview_evaluations" on public.interview_evaluations;
create policy "Directors can manage interview_evaluations" on public.interview_evaluations
  for all using (public.is_director());

drop policy if exists "Directors can read interview_evaluations" on public.interview_evaluations;
create policy "Directors can read interview_evaluations" on public.interview_evaluations
  for select using (public.is_director());

drop policy if exists "Panel can update own evaluations" on public.interview_evaluations;
create policy "Panel can update own evaluations" on public.interview_evaluations
  for update using (evaluator_id = auth.uid())
  with check (evaluator_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- J) Panel + interview applications (called_for_interview)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Panel can read interview applications" on public.applications;
create policy "Panel can read interview applications" on public.applications
  for select using (
    status = 'called_for_interview'
    and public.is_panel()
  );

drop policy if exists "Panel can insert own evaluations" on public.interview_evaluations;
create policy "Panel can insert own evaluations" on public.interview_evaluations
  for insert with check (
    evaluator_id = auth.uid()
    and public.is_panel()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.status = 'called_for_interview'
    )
  );

drop policy if exists "Panel can read evaluations for interview apps" on public.interview_evaluations;
create policy "Panel can read evaluations for interview apps" on public.interview_evaluations
  for select using (
    public.is_panel()
    and exists (
      select 1 from public.applications a where a.id = application_id and a.status = 'called_for_interview'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- K) site_settings: director UPDATE must not subquery profiles via RLS
--     (was: exists(select from profiles) → infinite recursion with panel policy)
-- ═══════════════════════════════════════════════════════════════
drop policy if exists "Directors can update site settings" on public.site_settings;
create policy "Directors can update site settings" on public.site_settings
  for all using (public.is_director())
  with check (public.is_director());

commit;
