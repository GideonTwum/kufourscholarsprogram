-- Director model (bcrypt password_hash from API; director code is never stored here)
-- id matches auth.users(id) for SSO with existing /director-login

create table if not exists public.directors (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_directors_email_lower on public.directors (lower(email));

comment on column public.directors.password_hash is 'bcrypt hash only; never plaintext.';

alter table public.directors enable row level security;
