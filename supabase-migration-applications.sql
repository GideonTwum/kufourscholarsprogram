-- =============================================
-- Kufuor Scholars — Applications + Applicant Flow Migration
-- Run this in your Supabase SQL Editor AFTER the profiles migration
-- =============================================

-- =============================================
-- STEP 1: Update profiles table for applicant flow
-- =============================================

-- Add 'applicant' to the allowed roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('scholar', 'director', 'pending', 'applicant'));

-- Remove the fixed class_name constraint so directors can assign any cohort
alter table public.profiles drop constraint if exists profiles_class_name_check;

-- Update the trigger to default new registrations to 'applicant' (not 'scholar')
-- Also stores class_name when provided (for existing scholar sign-ups)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, class_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'applicant'),
    new.raw_user_meta_data->>'class_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- =============================================
-- STEP 2: Create applications table
-- =============================================

create table if not exists public.applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text,
  date_of_birth date,
  phone text,
  address text,
  nationality text,
  university text,
  program text,
  year_of_study text,
  gpa text,
  essay text,
  cv_url text,
  recommendation_url text,
  photo_url text,
  video_url text,
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','shortlisted','interview','accepted','rejected')),
  director_notes text,
  submitted_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.applications enable row level security;

-- Applicants can read their own application
create policy "Users can read own application" on public.applications
  for select using (auth.uid() = user_id);

create policy "Users can insert own application" on public.applications
  for insert with check (auth.uid() = user_id);

create policy "Users can update own application" on public.applications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Directors can read all applications
create policy "Directors can read all applications" on public.applications
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- Directors can update application status/notes
create policy "Directors can update applications" on public.applications
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- =============================================
-- STEP 3: Allow directors to update any profile (for approving applicants)
-- =============================================

create policy "Directors can update any profile" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- =============================================
-- STEP 4: Storage bucket for application documents
-- =============================================

insert into storage.buckets (id, name, public)
  values ('applications', 'applications', false)
  on conflict (id) do nothing;

create policy "Users can upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'applications' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Directors can read all uploads"
  on storage.objects for select
  using (
    bucket_id = 'applications' and
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );
