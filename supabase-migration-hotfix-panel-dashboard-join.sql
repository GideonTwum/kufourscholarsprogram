-- Panel dashboard: safe profile visibility + interview-stage applications
-- Idempotent. Run in Supabase SQL Editor after is_director() / catchup migrations.

-- Helpers (no RLS recursion)
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

-- Applicant profiles for panel scoring (explicit interview statuses)
drop policy if exists "Panel can read applicant profiles" on public.profiles;
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    public.is_panel()
    and (
      id = auth.uid()
      or id in (
        select user_id from public.applications
        where status in ('called_for_interview', 'interview')
      )
    )
  );

-- Interview-stage applications
drop policy if exists "Panel can read interview applications" on public.applications;
create policy "Panel can read interview applications" on public.applications
  for select using (
    public.is_panel()
    and status in ('called_for_interview', 'interview')
  );

-- Interview evaluations
drop policy if exists "Panel can insert own evaluations" on public.interview_evaluations;
create policy "Panel can insert own evaluations" on public.interview_evaluations
  for insert with check (
    evaluator_id = auth.uid()
    and public.is_panel()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.status in ('called_for_interview', 'interview')
    )
  );

drop policy if exists "Panel can read evaluations for interview apps" on public.interview_evaluations;
create policy "Panel can read evaluations for interview apps" on public.interview_evaluations
  for select using (
    public.is_panel()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.status in ('called_for_interview', 'interview')
    )
  );

-- Application uploads for interview applicants
drop policy if exists "Panel can read interview applicant uploads" on storage.objects;
create policy "Panel can read interview applicant uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications'
    and public.is_panel()
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications
      where status in ('called_for_interview', 'interview')
    )
  );
