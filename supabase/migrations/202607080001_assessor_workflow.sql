-- Allow Supabase Auth's new-user trigger to create assessor profiles.
-- Without this, inviting an assessor fails with "Database error saving new user"
-- because handle_new_user() inserts raw_user_meta_data.role into public.profiles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('scholar', 'director', 'pending', 'applicant', 'panel', 'assessor'));

create table if not exists public.assessor_assignments (
  id uuid primary key default gen_random_uuid(),
  assessor_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'reassigned')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(application_id, assessor_id)
);

create index if not exists assessor_assignments_assessor_id_idx
  on public.assessor_assignments(assessor_id);

create index if not exists assessor_assignments_application_id_idx
  on public.assessor_assignments(application_id);

create table if not exists public.application_assessments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  assessor_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage in ('stage_1', 'stage_2')),
  academic_score integer check (academic_score between 1 and 5),
  leadership_score integer check (leadership_score between 1 and 5),
  service_score integer check (service_score between 1 and 5),
  communication_score integer check (communication_score between 1 and 5),
  overall_score numeric(5,2),
  recommendation text not null check (
    recommendation in ('advance', 'hold', 'reject', 'recommend_interview')
  ),
  notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, assessor_id, stage)
);

create index if not exists application_assessments_application_id_idx
  on public.application_assessments(application_id);

create index if not exists application_assessments_assessor_id_idx
  on public.application_assessments(assessor_id);

alter table public.assessor_assignments enable row level security;
alter table public.application_assessments enable row level security;

create policy "directors can manage assessor assignments"
  on public.assessor_assignments
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director'));

create policy "assessors can read own assignments"
  on public.assessor_assignments
  for select
  using (assessor_id = auth.uid());

create policy "directors can read application assessments"
  on public.application_assessments
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'director'));

create policy "assessors can manage own assessments"
  on public.application_assessments
  for all
  using (assessor_id = auth.uid())
  with check (assessor_id = auth.uid());
