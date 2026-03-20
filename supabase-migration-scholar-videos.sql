-- =============================================
-- KSP — Scholar video spotlights (YouTube links on landing)
-- Safe to re-run
-- =============================================

create table if not exists public.scholar_videos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  youtube_url text not null,
  scholar_name text,
  preview_seconds int not null default 60
    check (preview_seconds >= 10 and preview_seconds <= 600),
  display_order int default 0,
  is_published boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_scholar_videos_order on public.scholar_videos(display_order);
create index if not exists idx_scholar_videos_published on public.scholar_videos(is_published) where is_published = true;

alter table public.scholar_videos enable row level security;

drop policy if exists "Anyone can read published scholar videos" on public.scholar_videos;
drop policy if exists "Directors can manage scholar videos" on public.scholar_videos;

create policy "Anyone can read published scholar videos" on public.scholar_videos
  for select using (is_published = true);

create policy "Directors can manage scholar videos" on public.scholar_videos
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director')
  );
