-- Atomically accept an applicant and promote their profile to scholar.
-- The caller must be an authenticated director.
create or replace function public.accept_application(
  application_id uuid,
  cohort_class_name text,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_user_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'director'
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if nullif(trim(cohort_class_name), '') is null then
    raise exception 'class_name is required';
  end if;

  select user_id
  into applicant_user_id
  from public.applications
  where id = application_id
  for update;

  if applicant_user_id is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  update public.profiles
  set role = 'scholar', class_name = trim(cohort_class_name)
  where id = applicant_user_id;

  if not found then
    raise exception 'Applicant profile not found' using errcode = 'P0002';
  end if;

  update public.applications
  set
    status = 'accepted',
    director_notes = coalesce(notes, director_notes),
    rejection_reason = null,
    updated_at = now()
  where id = application_id;
end;
$$;

revoke all on function public.accept_application(uuid, text, text) from public;
grant execute on function public.accept_application(uuid, text, text) to authenticated;
