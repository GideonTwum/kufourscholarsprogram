-- =============================================
-- Kufuor Scholars — Public Website Data Model
-- Run this in your Supabase SQL Editor
-- Phase 1: scholars, projects, events
-- =============================================

-- 1. Scholars table (for directory, spotlight, alumni)
create table if not exists public.scholars (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  slug text not null unique,
  cohort_year text not null,
  university text,
  field_of_study text,
  bio text,
  leadership_interests text,
  projects_summary text,
  achievements text,
  linkedin_url text,
  photo_url text,
  quote text,
  is_featured boolean default false,
  is_alumni boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_scholars_slug on public.scholars(slug);
create index if not exists idx_scholars_cohort on public.scholars(cohort_year);
create index if not exists idx_scholars_university on public.scholars(university);
create index if not exists idx_scholars_featured on public.scholars(is_featured) where is_featured = true;

alter table public.scholars enable row level security;

-- Everyone can read scholars (public directory)
create policy "Anyone can read scholars" on public.scholars
  for select using (true);

-- Only directors can manage
create policy "Directors can manage scholars" on public.scholars
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- 2. Projects table (scholar-led initiatives)
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  scholar_id uuid references public.scholars(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  impact_metrics jsonb default '{}',
  location text,
  year text,
  photo_urls text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_projects_slug on public.projects(slug);
create index if not exists idx_projects_scholar on public.projects(scholar_id);

alter table public.projects enable row level security;

create policy "Anyone can read projects" on public.projects
  for select using (true);

create policy "Directors can manage projects" on public.projects
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- 3. Events table (leadership events, summits, seminars)
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text not null unique,
  description text,
  event_date date not null,
  event_time text,
  location text,
  photo_url text,
  created_at timestamptz default now()
);

create index if not exists idx_events_slug on public.events(slug);
create index if not exists idx_events_date on public.events(event_date);

alter table public.events enable row level security;

create policy "Anyone can read events" on public.events
  for select using (true);

create policy "Directors can manage events" on public.events
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );
