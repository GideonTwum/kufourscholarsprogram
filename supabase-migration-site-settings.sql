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

-- Everyone can read (for homepage, etc.)
create policy "Anyone can read site settings" on public.site_settings
  for select using (true);

-- Only directors can update
create policy "Directors can update site settings" on public.site_settings
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- Insert defaults
insert into public.site_settings (key, value)
values 
  ('applications_open', 'false'),
  ('application_deadline', '')
on conflict (key) do nothing;
