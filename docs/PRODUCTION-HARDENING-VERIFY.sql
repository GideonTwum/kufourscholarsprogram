-- Verification queries for 202608030001_production_hardening.sql
-- Run in Supabase SQL Editor AFTER and AFTER applying the migration.

-- 1) handle_new_user must hardcode applicant (not metadata.role)
SELECT pg_get_functiondef('public.handle_new_user'::regproc);

-- 2) Profile role protection trigger
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass
  AND NOT tgisinternal;

-- 3) Application status protection trigger
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.applications'::regclass
  AND NOT tgisinternal;

-- 4) Status CHECK must match launch statuses
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.applications'::regclass
  AND conname = 'applications_status_check';

-- 5) No administrator roles remain
SELECT role, count(*)
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 6) Manual privilege-escalation proof (expect FAILURE after migration):
-- As an authenticated applicant session (not service_role):
--   update public.profiles set role = 'director' where id = auth.uid();
-- Expected: exception "Changing profile role is not allowed"
--
-- As applicant:
--   update public.applications set status = 'accepted' where user_id = auth.uid();
-- Expected: exception "Applicants cannot change application status"
