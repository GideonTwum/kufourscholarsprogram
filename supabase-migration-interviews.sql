-- =============================================
-- Kufuor Scholars — Interview Scheduling
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Create interview_slots table
create table if not exists public.interview_slots (
  id uuid default gen_random_uuid() primary key,
  director_id uuid references public.profiles(id) on delete cascade not null,
  batch_name text not null,
  interview_date date not null,
  interview_time text not null,
  location text not null,
  congratulations_message text,
  created_at timestamptz default now()
);

alter table public.interview_slots enable row level security;

-- 2. Add interview_slot_id to applications
alter table public.applications add column if not exists interview_slot_id uuid references public.interview_slots(id) on delete set null;

-- 3. RLS for interview_slots
drop policy if exists "Directors can manage interview slots" on public.interview_slots;
create policy "Directors can manage interview slots" on public.interview_slots
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

drop policy if exists "Applicants can read own interview slot" on public.interview_slots;
create policy "Applicants can read own interview slot" on public.interview_slots
  for select using (
    exists (
      select 1 from public.applications a
      where a.interview_slot_id = id and a.user_id = auth.uid()
    )
  );

-- 4. Directors can update applications (for interview_slot_id assignment) - may already exist
-- Applicants need to read interview_slot_id - it's part of applications which they can already read
