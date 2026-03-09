-- =============================================
-- KSP Panel — Fix infinite recursion in profiles RLS
-- The "Panel can read applicant profiles" policy selected from profiles,
-- causing recursion. Use a SECURITY DEFINER helper like is_director().
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create helper function (bypasses RLS)
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

-- 2. Drop the problematic profiles policy
drop policy if exists "Panel can read applicant profiles" on public.profiles;

-- 3. Recreate using the helper (no recursion)
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    public.is_panel()
    and (id = auth.uid() or id in (select user_id from public.applications where status = 'interview'))
  );

-- 4. Fix applications policy (also selected from profiles)
drop policy if exists "Panel can read interview applications" on public.applications;
create policy "Panel can read interview applications" on public.applications
  for select using (
    status = 'interview' and public.is_panel()
  );

-- 5. Fix interview_evaluations policies
drop policy if exists "Panel can insert own evaluations" on public.interview_evaluations;
create policy "Panel can insert own evaluations" on public.interview_evaluations
  for insert with check (
    evaluator_id = auth.uid()
    and public.is_panel()
    and exists (select 1 from public.applications a where a.id = application_id and a.status = 'interview')
  );

drop policy if exists "Panel can read evaluations for interview apps" on public.interview_evaluations;
create policy "Panel can read evaluations for interview apps" on public.interview_evaluations
  for select using (
    public.is_panel()
    and exists (select 1 from public.applications a where a.id = application_id and a.status = 'interview')
  );

-- 6. Fix storage policy
drop policy if exists "Panel can read interview applicant uploads" on storage.objects;
create policy "Panel can read interview applicant uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications'
    and public.is_panel()
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications where status = 'interview'
    )
  );
