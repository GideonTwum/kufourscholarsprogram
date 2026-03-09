-- =============================================
-- KSP Panel Members — Interview Scoring Access
-- Run AFTER supabase-migration-applications-v2.sql
-- =============================================

-- 1. Add 'panel' role to profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('scholar', 'director', 'pending', 'applicant', 'panel'));

-- 2. Panel can READ applications where status = 'interview'
create policy "Panel can read interview applications" on public.applications
  for select using (
    status = 'interview' and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
  );

-- 3. Panel can INSERT their own interview evaluations
create policy "Panel can insert own evaluations" on public.interview_evaluations
  for insert with check (
    evaluator_id = auth.uid() and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel') and
    exists (select 1 from public.applications a where a.id = application_id and a.status = 'interview')
  );

-- 4. Panel can UPDATE their own evaluations only
create policy "Panel can update own evaluations" on public.interview_evaluations
  for update using (evaluator_id = auth.uid())
  with check (evaluator_id = auth.uid());

-- 5. Panel can SELECT evaluations (their own + for applications they can see)
create policy "Panel can read evaluations for interview apps" on public.interview_evaluations
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel') and
    exists (select 1 from public.applications a where a.id = application_id and a.status = 'interview')
  );

-- 6. Panel can read profiles for applicants in interview (for display names)
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
    and (id = auth.uid() or id in (select user_id from public.applications where status = 'interview'))
  );

-- 7. Panel can read storage for interview applicants' documents
create policy "Panel can read interview applicant uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'panel')
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications where status = 'interview'
    )
  );
