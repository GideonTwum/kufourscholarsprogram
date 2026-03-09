-- =============================================
-- KSP — Fix profiles RLS infinite recursion
-- Run this in your Supabase SQL Editor
-- Fixes Director policy that caused recursion
-- =============================================

-- 1. Create/replace is_director() helper (bypasses RLS)
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

-- 2. Drop problematic policies (Director + Panel if present)
drop policy if exists "Directors can read all profiles" on public.profiles;
drop policy if exists "Panel can read applicant profiles" on public.profiles;

-- 3. Recreate Directors policy (no recursion)
create policy "Directors can read all profiles" on public.profiles
  for select using (public.is_director());

-- 4. Ensure Authenticated can read director profiles (for Contact Director)
drop policy if exists "Authenticated can read director profiles" on public.profiles;
create policy "Authenticated can read director profiles" on public.profiles
  for select using (auth.uid() is not null and role = 'director');
