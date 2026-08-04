-- Kufuor Scholars Program production RLS inspection checks.
-- Run read-only sections in Supabase SQL Editor. Do not disable RLS.

-- 1) Confirm RLS is enabled on critical tables.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'applications',
    'assessor_assignments',
    'application_assessments',
    'interview_evaluations',
    'notifications'
  )
order by tablename;

-- 2) Inspect policies on critical public tables.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'applications',
    'assessor_assignments',
    'application_assessments',
    'interview_evaluations',
    'notifications'
  )
order by tablename, policyname;

-- 3) Inspect storage policies for private application uploads.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 4) Find policies that may recurse through public.profiles directly.
-- Review any rows returned here. Prefer security-definer helpers such as
-- public.is_director(), public.is_panel(), and public.is_assessor().
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where (qual ilike '%from public.profiles%' or with_check ilike '%from public.profiles%')
order by schemaname, tablename, policyname;

-- 5) Confirm helper functions exist.
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_director', 'is_panel', 'is_assessor')
order by proname;

-- 6) Confirm role constraint includes assessor.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';
