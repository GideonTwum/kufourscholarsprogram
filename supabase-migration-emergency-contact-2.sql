-- Second emergency contact for Stage 1 applications
alter table public.applications add column if not exists emergency_contact_2_name text;
alter table public.applications add column if not exists emergency_contact_2_number text;
