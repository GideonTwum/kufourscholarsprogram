-- =============================================
-- Kufuor Scholars — Fix profiles RLS infinite recursion
-- The "Directors can read all profiles" policy caused recursion by
-- selecting from profiles while evaluating a policy ON profiles.
-- Solution: Use a SECURITY DEFINER function to check director role.
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create helper function (bypasses RLS)
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

-- 2. Drop the problematic policy
drop policy if exists "Directors can read all profiles" on public.profiles;

-- 3. Recreate using the helper (no recursion)
create policy "Directors can read all profiles" on public.profiles
  for select using (public.is_director());

-- 4. Allow authenticated users to read director profiles (for Contact Director)
drop policy if exists "Authenticated can read director profiles" on public.profiles;
create policy "Authenticated can read director profiles" on public.profiles
  for select using (auth.uid() is not null and role = 'director');
