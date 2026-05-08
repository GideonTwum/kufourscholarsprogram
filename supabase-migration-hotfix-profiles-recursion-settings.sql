-- =============================================================================
-- HOTFIX — Run once in Supabase SQL Editor if you see:
--   "infinite recursion detected in policy for relation \"profiles\""
-- when toggling applications open/closed or reading profiles.
--
-- Cause: Policies that SELECT from public.profiles while evaluating RLS on
-- public.profiles (e.g. "Panel can read applicant profiles"). Also,
-- site_settings updates used EXISTS (SELECT ... FROM profiles) under profiles RLS.
--
-- Depends on tables/policies from prior migrations existing.
-- =============================================================================

begin;

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

-- Director site settings toggle (applications open / deadline)
drop policy if exists "Directors can update site settings" on public.site_settings;
create policy "Directors can update site settings" on public.site_settings
  for all using (public.is_director())
  with check (public.is_director());

-- Panel reads profiles — must not nest profiles SELECT inside profiles RLS
drop policy if exists "Panel can read applicant profiles" on public.profiles;
create policy "Panel can read applicant profiles" on public.profiles
  for select using (
    public.is_panel()
    and (
      id = auth.uid()
      or id in (select user_id from public.applications where status = 'called_for_interview')
    )
  );

-- Storage · panel uploads (applications bucket)
drop policy if exists "Panel can read interview applicant uploads" on storage.objects;
create policy "Panel can read interview applicant uploads" on storage.objects
  for select using (
    bucket_id = 'applications'
    and public.is_panel()
    and (storage.foldername(name))[1] in (
      select user_id::text from public.applications where status = 'called_for_interview'
    )
  );

-- Applications / evaluations (present if catch-up or panel migrations ran)
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

commit;
