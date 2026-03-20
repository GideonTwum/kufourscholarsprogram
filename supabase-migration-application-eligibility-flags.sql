-- Ghana enrollment attestation (Stage 1 form)
alter table public.applications add column if not exists confirms_ghana_enrollment boolean default false;

comment on column public.applications.confirms_ghana_enrollment is 'Applicant confirms they are currently enrolled at a tertiary institution in Ghana.';
