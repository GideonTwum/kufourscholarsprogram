-- Verify interview queue / batch workflow (read-only).
-- Replace REPLACE_WITH_DIRECTOR_EMAIL if filtering by actor is needed later.

-- 1) Shortlisted / unscheduled queue
SELECT id, status, interview_slot_id, interview_shortlisted_at, full_name
FROM public.applications
WHERE status = 'interview_review_pending'
  AND interview_slot_id IS NULL
ORDER BY interview_shortlisted_at DESC NULLS LAST
LIMIT 50;

-- 2) Active batch assignments
SELECT a.id AS application_id, a.status, a.interview_slot_id, s.batch_name, s.status AS slot_status
FROM public.applications a
JOIN public.interview_slots s ON s.id = a.interview_slot_id
WHERE a.status = 'called_for_interview'
ORDER BY s.interview_date DESC
LIMIT 50;

-- 3) Duplicate active assignments (must be empty for distinct apps — each app has at most one slot FK)
SELECT interview_slot_id, count(*)
FROM public.applications
WHERE interview_slot_id IS NOT NULL
  AND status IN ('called_for_interview', 'interview')
GROUP BY interview_slot_id
ORDER BY count(*) DESC;

-- 4) Column presence
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'applications'
  AND column_name IN ('interview_slot_id', 'interview_shortlisted_at')
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'interview_slots'
  AND column_name IN ('batch_name', 'status', 'completed_at', 'cancelled_at', 'meeting_link')
ORDER BY column_name;
