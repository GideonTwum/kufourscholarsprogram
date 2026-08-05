-- VERIFY-AUTH-LIFECYCLE-HARDENING.sql
-- Manual checks after applying 202608060001_auth_mfa_lifecycle_hardening.sql
-- Do NOT commit real user UUIDs. Replace placeholders before running.

-- 1) Function exists and mentions lifecycle columns
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'protect_profile_privileged_columns';

-- Expect definition to raise on is_active / deactivated_at / deactivated_by
-- and to allow only service_role bypass (no director JWT bypass).

-- 2) As an authenticated applicant JWT (SQL editor "role" = authenticated is NOT enough;
--    use a real applicant session via the app or an RLS test harness):
-- Attempt:
--   UPDATE public.profiles SET role = 'director' WHERE id = 'REPLACE_WITH_APPLICANT_ID';
-- Expect: exception "Changing profile role is not allowed"

-- 3) As an assessor JWT:
--   UPDATE public.profiles SET is_active = true WHERE id = 'REPLACE_WITH_ASSESSOR_ID';
-- Expect: exception "Changing is_active is not allowed"

-- 4) As a panel JWT (deactivated account if available):
--   UPDATE public.profiles SET deactivated_at = NULL, deactivated_by = NULL, is_active = true
--   WHERE id = 'REPLACE_WITH_PANEL_ID';
-- Expect: exception on is_active or deactivated_at

-- 5) As a Director JWT (user client, NOT service role):
--   UPDATE public.profiles SET is_active = false WHERE id = 'REPLACE_WITH_ASSESSOR_ID';
-- Expect: exception — Directors must use Admin APIs (service_role)

-- 6) Service-role path still works (Dashboard SQL as postgres / service role, or API):
--   UPDATE public.profiles
--   SET is_active = false,
--       deactivated_at = now(),
--       deactivated_by = 'REPLACE_WITH_DIRECTOR_ID'
--   WHERE id = 'REPLACE_WITH_ASSESSOR_ID' AND role = 'assessor';
-- Expect: success

-- 7) Non-privileged profile edits still work for the owner (applicant JWT):
--   UPDATE public.profiles SET full_name = full_name WHERE id = auth.uid();
-- Expect: success

-- 8) Trigger present
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass
  AND tgname = 'trg_protect_profile_privileged_columns';
