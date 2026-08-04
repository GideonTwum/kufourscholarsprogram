-- Verification queries after 202608040002_director_security_operations.sql
-- Run in Supabase SQL Editor (read-only checks).

-- 1) Audit table exists
SELECT to_regclass('public.director_audit_events') AS audit_table;

-- 2) Policies on audit table
SELECT polname, cmd
FROM pg_policies
WHERE tablename = 'director_audit_events'
ORDER BY polname;

-- 3) Interview slot status column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'interview_slots'
  AND column_name IN ('status', 'meeting_link', 'cancelled_at', 'updated_at');

-- 4) Active directors
SELECT id, email, is_active
FROM public.profiles
WHERE role = 'director'
ORDER BY created_at;

-- 5) Announcement audiences after remap
SELECT audience, count(*)
FROM public.announcements
GROUP BY audience
ORDER BY audience;

-- 6) Profiles self-read policies (required for Director login)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
  AND policyname IN (
    'Users can read own profile',
    'Directors can read all profiles',
    'Authenticated can read director profiles'
  )
ORDER BY policyname;
