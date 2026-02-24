-- =============================================
-- Kufuor Scholars — Announcements Migration
-- Run this in your Supabase SQL Editor
-- =============================================

create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  director_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all','submitted','under_review','shortlisted','interview')),
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

-- Directors can do everything
drop policy if exists "Directors can manage announcements" on public.announcements;
create policy "Directors can manage announcements" on public.announcements
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- Applicants can read announcements matching their status or 'all'
drop policy if exists "Applicants can read relevant announcements" on public.announcements;
create policy "Applicants can read relevant announcements" on public.announcements
  for select using (
    audience = 'all'
    or audience in (
      select a.status from public.applications a
      where a.user_id = auth.uid()
    )
  );
