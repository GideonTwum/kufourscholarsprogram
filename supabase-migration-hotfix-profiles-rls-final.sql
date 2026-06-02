-- Run in Supabase SQL Editor if directors cannot see applications (RLS recursion on profiles).
-- Safe to re-run.

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

drop policy if exists "Directors can read all profiles" on public.profiles;
create policy "Directors can read all profiles" on public.profiles
  for select using (public.is_director());

drop policy if exists "Directors can read all applications" on public.applications;
create policy "Directors can read all applications" on public.applications
  for select using (public.is_director());

drop policy if exists "Directors can update applications" on public.applications;
create policy "Directors can update applications" on public.applications
  for update using (public.is_director());
