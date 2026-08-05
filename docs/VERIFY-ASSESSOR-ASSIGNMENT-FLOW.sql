-- Verify Director → Assessor assignment flow
-- Run after 202608040001 and 202608040004 (read-only).

-- 1) Active assessors
SELECT id, email, full_name, is_active
FROM public.profiles
WHERE role = 'assessor'
ORDER BY is_active DESC, full_name;

-- 2) Active assignments
SELECT aa.id, aa.application_id, aa.assessor_id, aa.status, aa.assigned_at,
       p.email AS assessor_email, a.status AS application_status
FROM public.assessor_assignments aa
JOIN public.profiles p ON p.id = aa.assessor_id
JOIN public.applications a ON a.id = aa.application_id
WHERE aa.status = 'active'
ORDER BY aa.assigned_at DESC;

-- 3) Duplicate active assignments (must be empty)
SELECT application_id, count(*) AS active_count
FROM public.assessor_assignments
WHERE status = 'active'
GROUP BY application_id
HAVING count(*) > 1;

-- 4) One-active index
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'assessor_assignments_one_active_per_application';

-- 5) Assignment policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'assessor_assignments'
ORDER BY policyname;

-- 6) Eligibility snapshot — apps assignable vs already assigned
SELECT a.status, count(*) AS apps,
       count(aa.id) FILTER (WHERE aa.status = 'active') AS with_active_assessor
FROM public.applications a
LEFT JOIN public.assessor_assignments aa
  ON aa.application_id = a.id AND aa.status = 'active'
WHERE a.status IN (
  'stage_1_submitted',
  'review_pending',
  'stage_1_approved',
  'stage_2_submitted',
  'stage_2_review_pending'
)
GROUP BY a.status
ORDER BY a.status;
