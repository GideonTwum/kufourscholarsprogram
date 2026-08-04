-- Allow Supabase Auth's new-user trigger to create assessor profiles.
-- Without this, inviting an assessor fails with "Database error saving new user"
-- because handle_new_user() inserts raw_user_meta_data.role into public.profiles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('scholar', 'director', 'pending', 'applicant', 'panel', 'assessor'));

create or replace function public.is_assessor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'assessor'
  );
$$;

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

drop policy if exists "Assessors can read assigned applications" on public.applications;
create policy "Assessors can read assigned applications"
  on public.applications
  for select
  using (
    public.is_assessor()
    and exists (
      select 1
      from public.assessor_assignments aa
      where aa.application_id = applications.id
        and aa.assessor_id = auth.uid()
        and aa.status = 'active'
    )
  );

drop policy if exists "Assessors can read assigned applicant profiles" on public.profiles;
create policy "Assessors can read assigned applicant profiles"
  on public.profiles
  for select
  using (
    public.is_assessor()
    and (
      id = auth.uid()
      or id in (
        select a.user_id
        from public.applications a
        join public.assessor_assignments aa on aa.application_id = a.id
        where aa.assessor_id = auth.uid()
          and aa.status = 'active'
      )
    )
  );

drop policy if exists "Assessors can read assigned applicant uploads" on storage.objects;
create policy "Assessors can read assigned applicant uploads"
  on storage.objects
  for select
  using (
    bucket_id = 'applications'
    and public.is_assessor()
    and (storage.foldername(name))[1] in (
      select a.user_id::text
      from public.applications a
      join public.assessor_assignments aa on aa.application_id = a.id
      where aa.assessor_id = auth.uid()
        and aa.status = 'active'
    )
  );

drop policy if exists "directors can manage assessor assignments" on public.assessor_assignments;
create policy "directors can manage assessor assignments"
  on public.assessor_assignments
  for all
  using (public.is_director())
  with check (public.is_director());

drop policy if exists "assessors can read own assignments" on public.assessor_assignments;
create policy "assessors can read own assignments"
  on public.assessor_assignments
  for select
  using (assessor_id = auth.uid() and public.is_assessor());

drop policy if exists "directors can read application assessments" on public.application_assessments;
create policy "directors can read application assessments"
  on public.application_assessments
  for select
  using (public.is_director());

drop policy if exists "assessors can manage own assessments" on public.application_assessments;
create policy "assessors can manage own assessments"
  on public.application_assessments
  for all
  using (assessor_id = auth.uid() and public.is_assessor())
  with check (assessor_id = auth.uid() and public.is_assessor());
