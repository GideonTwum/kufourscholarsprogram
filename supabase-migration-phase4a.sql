-- =============================================
-- Kufuor Scholars — Phase 4A Migration
-- Profile extensions, Conversations, Messages, Requests
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- STEP 1: Extend profiles table
-- =============================================

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists nationality text;

-- =============================================
-- STEP 2: Conversations table
-- =============================================

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('direct', 'group')),
  name text,
  class_name text,
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;

-- =============================================
-- STEP 3: Conversation members table
-- =============================================

create table if not exists public.conversation_members (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

alter table public.conversation_members enable row level security;

-- =============================================
-- STEP 4: Messages table
-- =============================================

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

-- =============================================
-- STEP 5: Requests table
-- =============================================

create table if not exists public.requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  director_response text,
  responded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.requests enable row level security;

-- =============================================
-- STEP 6: RLS Policies — Conversations
-- =============================================

create policy "Members can view conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = id and cm.user_id = auth.uid()
    )
  );

create policy "Directors can view all conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

create policy "Authenticated users can create conversations" on public.conversations
  for insert with check (auth.uid() is not null);

-- =============================================
-- STEP 7: RLS Policies — Conversation Members
-- =============================================

create policy "Members can view conversation members" on public.conversation_members
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

create policy "Directors can view all members" on public.conversation_members
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

create policy "Authenticated users can add members" on public.conversation_members
  for insert with check (auth.uid() is not null);

-- =============================================
-- STEP 8: RLS Policies — Messages
-- =============================================

create policy "Members can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

create policy "Directors can view all messages" on public.messages
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

create policy "Members can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

-- =============================================
-- STEP 9: RLS Policies — Requests
-- =============================================

create policy "Scholars can read own requests" on public.requests
  for select using (auth.uid() = user_id);

create policy "Scholars can create requests" on public.requests
  for insert with check (auth.uid() = user_id);

create policy "Directors can read all requests" on public.requests
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

create policy "Directors can update requests" on public.requests
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- =============================================
-- STEP 10: Avatars storage bucket
-- =============================================

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- =============================================
-- STEP 11: Enable realtime for messages
-- =============================================

alter publication supabase_realtime add table public.messages;
