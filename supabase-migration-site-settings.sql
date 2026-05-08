-- =============================================
-- Kufuor Scholars — Site Settings
-- Run this in your Supabase SQL Editor
-- =============================================

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

-- Required by director policy below (no-op replace if migrations already ran)
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

-- Everyone can read (for homepage, etc.)
create policy "Anyone can read site settings" on public.site_settings
  for select using (true);

-- Only directors can update (uses security definer — must not EXISTS-select profiles
-- under profiles RLS or you get infinite recursion with panel-read policies.)
create policy "Directors can update site settings" on public.site_settings
  for all using (public.is_director())
  with check (public.is_director());

-- Insert defaults
insert into public.site_settings (key, value)
values 
  ('applications_open', 'false'),
  ('application_deadline', '')
on conflict (key) do nothing;
