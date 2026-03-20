-- CWA / CGPA / GPA + multiple leadership evidence files
alter table public.applications add column if not exists grade_type text;

alter table public.applications drop constraint if exists applications_grade_type_check;
alter table public.applications add constraint applications_grade_type_check
  check (grade_type is null or grade_type in ('CWA', 'CGPA', 'GPA'));

alter table public.applications add column if not exists leadership_evidence_urls jsonb default '[]'::jsonb;

-- One-time backfill: copy legacy single file into JSON array when array is empty
update public.applications
set leadership_evidence_urls = jsonb_build_array(leadership_evidence_url)
where leadership_evidence_url is not null
  and trim(leadership_evidence_url) <> ''
  and (leadership_evidence_urls is null or leadership_evidence_urls = '[]'::jsonb);
