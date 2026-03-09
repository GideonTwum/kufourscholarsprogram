-- =============================================
-- KSP Applications V2 — Stage 1/2 Split + Interview Scoring
-- Run AFTER supabase-migration-applications.sql
-- =============================================

-- 1. Add new Personal Info columns
alter table public.applications add column if not exists hometown text;
alter table public.applications add column if not exists region text;
alter table public.applications add column if not exists country_of_origin text;
alter table public.applications add column if not exists emergency_contact_name text;
alter table public.applications add column if not exists emergency_contact_number text;
alter table public.applications add column if not exists linkedin_url text;
alter table public.applications add column if not exists instagram_url text;
alter table public.applications add column if not exists facebook_url text;
alter table public.applications add column if not exists tiktok_url text;
alter table public.applications add column if not exists snapchat_url text;
alter table public.applications add column if not exists twitter_url text;

-- 2. Add new Academic Info columns
alter table public.applications add column if not exists junior_high_school text;
alter table public.applications add column if not exists senior_high_school text;
alter table public.applications add column if not exists student_id text;

-- 3. Add Stage 1 document columns (distinct URLs)
alter table public.applications add column if not exists cv_personal_statement_url text;
alter table public.applications add column if not exists academic_transcript_url text;
alter table public.applications add column if not exists leadership_evidence_url text;
-- recommendation_url already exists

-- 4. Add Stage 2 video column
alter table public.applications add column if not exists video_youtube_url text;
alter table public.applications add column if not exists stage2_submitted_at timestamptz;

-- 5. Migrate existing cv_url to cv_personal_statement_url for backward compatibility
update public.applications
set cv_personal_statement_url = cv_url
where cv_url is not null and cv_personal_statement_url is null;

-- 6. Update status check constraint for new flow
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in (
    'draft',
    'stage1_submitted',
    'under_review',
    'shortlisted_for_stage2',
    'stage2_submitted',
    'interview',
    'accepted',
    'rejected'
  ));

-- 7. Map old 'submitted' to 'stage1_submitted', 'shortlisted' to 'shortlisted_for_stage2'
update public.applications set status = 'stage1_submitted' where status = 'submitted';
update public.applications set status = 'shortlisted_for_stage2' where status = 'shortlisted';

-- 8. Create interview_evaluations table
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

create policy "Directors can manage interview_evaluations" on public.interview_evaluations
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

create policy "Directors can read interview_evaluations" on public.interview_evaluations
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );
