-- Verify assessor application load path (read-only).
-- Replace REPLACE_WITH_ASSESSOR_EMAIL with the email of the assessor you want to inspect.

-- 1) Active assessor profile
SELECT id, email, full_name, role, is_active
FROM public.profiles
WHERE role = 'assessor'
  AND lower(email) = lower('REPLACE_WITH_ASSESSOR_EMAIL');

-- 2) Active assignments for that assessor
SELECT aa.id, aa.application_id, aa.status, aa.assigned_at, a.status AS app_status, a.full_name
FROM public.assessor_assignments aa
JOIN public.applications a ON a.id = aa.application_id
JOIN public.profiles p ON p.id = aa.assessor_id
WHERE p.role = 'assessor'
  AND lower(p.email) = lower('REPLACE_WITH_ASSESSOR_EMAIL')
  AND aa.status = 'active'
ORDER BY aa.assigned_at DESC;

-- 3) Assignment status distribution
SELECT status, count(*)
FROM public.assessor_assignments
GROUP BY status
ORDER BY status;

-- 4) Duplicate active assignments (must be empty)
SELECT application_id, count(*)
FROM public.assessor_assignments
WHERE status = 'active'
GROUP BY application_id
HAVING count(*) > 1;

-- 5) Confirm applications has no created_at (assessor select must not request it)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'applications'
  AND column_name IN ('created_at', 'updated_at', 'submitted_at', 'stage_1_submitted_at', 'stage_2_submitted_at')
ORDER BY column_name;

-- 6) Policies on assessor_assignments / applications / application_assessments
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('assessor_assignments', 'applications', 'application_assessments', 'profiles')
ORDER BY tablename, policyname;

-- 7) Helper security_definer
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_assessor', 'is_active_assessor', 'assessor_can_read_profile', 'is_director')
ORDER BY p.proname;
