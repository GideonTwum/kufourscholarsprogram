-- =============================================
-- Kufuor Scholars — Profiles Table Migration
-- Run this in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
-- =============================================

-- 1. Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'scholar' check (role in ('scholar', 'director', 'pending')),
  class_name text check (class_name in ('Class of 2026', 'Class of 2027', 'Class of 2028')),
  status text not null default 'active' check (status in ('active', 'suspended', 'pending_verification')),
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. RLS Policies

-- Users can read their own profile
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Directors can read all profiles (to see scholar lists)
create policy "Directors can read all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, class_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'scholar'),
    new.raw_user_meta_data->>'class_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
