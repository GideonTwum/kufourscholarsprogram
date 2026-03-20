-- =============================================
-- KSP — Teams & Mentors
-- Run this in your Supabase SQL Editor
-- Safe to re-run: policies are dropped before recreate
-- =============================================

-- 1. Teams table (Leadership, Program, Advisory, etc.)
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  description text,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_teams_slug on public.teams(slug);
create index if not exists idx_teams_order on public.teams(display_order);

alter table public.teams enable row level security;

drop policy if exists "Anyone can read teams" on public.teams;
drop policy if exists "Directors can manage teams" on public.teams;

create policy "Anyone can read teams" on public.teams
  for select using (true);

create policy "Directors can manage teams" on public.teams
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

-- 2. Mentors table
create table if not exists public.mentors (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete set null,
  full_name text not null,
  slug text not null unique,
  title text,
  bio text,
  photo_url text,
  linkedin_url text,
  expertise text,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_mentors_slug on public.mentors(slug);
create index if not exists idx_mentors_team on public.mentors(team_id);
create index if not exists idx_mentors_order on public.mentors(display_order);

alter table public.mentors enable row level security;

drop policy if exists "Anyone can read mentors" on public.mentors;
drop policy if exists "Directors can manage mentors" on public.mentors;

create policy "Anyone can read mentors" on public.mentors
  for select using (true);

create policy "Directors can manage mentors" on public.mentors
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

-- 3. Storage bucket for mentor photos (Director uploads from dashboard)
insert into storage.buckets (id, name, public)
  values ('mentors', 'mentors', true)
  on conflict (id) do nothing;

drop policy if exists "Anyone can view mentor photos" on storage.objects;
drop policy if exists "Directors can upload mentor photos" on storage.objects;
drop policy if exists "Directors can update mentor photos" on storage.objects;
drop policy if exists "Directors can delete mentor photos" on storage.objects;

create policy "Anyone can view mentor photos"
  on storage.objects for select
  using (bucket_id = 'mentors');

create policy "Directors can upload mentor photos"
  on storage.objects for insert
  with check (
    bucket_id = 'mentors'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

create policy "Directors can update mentor photos"
  on storage.objects for update
  using (
    bucket_id = 'mentors'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );

create policy "Directors can delete mentor photos"
  on storage.objects for delete
  using (
    bucket_id = 'mentors'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );
