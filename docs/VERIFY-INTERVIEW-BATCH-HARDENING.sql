-- Read-only production verification for KSP batch interviews.
-- Run BEFORE applying pending migrations, then again AFTER.
-- Do not execute 202610300001 again. Do not UPDATE/DELETE applicant rows here.

-- 1) Applied vs pending interview migrations (Supabase migration history if used)
-- SELECT version, name FROM supabase_migrations.schema_migrations
-- WHERE version LIKE '20261030%' OR version LIKE '20261101%'
-- ORDER BY version;

-- 2) Live published assignments that must not be lost
SELECT
  count(*) AS assigned_applications,
  count(*) FILTER (WHERE status = 'called_for_interview') AS called_for_interview,
  count(*) FILTER (WHERE status = 'interview') AS interview_complete
FROM public.applications
WHERE interview_slot_id IS NOT NULL;

SELECT
  s.id,
  s.batch_name,
  s.interview_date,
  s.status,
  s.published_at,
  s.invitation_sent_at,
  s.capacity,
  (
    SELECT count(*) FROM public.applications a
    WHERE a.interview_slot_id = s.id
  ) AS applicants_on_slot
FROM public.interview_slots s
WHERE EXISTS (
  SELECT 1 FROM public.applications a WHERE a.interview_slot_id = s.id
)
ORDER BY s.interview_date, s.interview_time;

-- 3) Status distribution must not shift unexpectedly after additive migrations
SELECT status, count(*)
FROM public.applications
GROUP BY status
ORDER BY status;

-- 4) Location confirmation table (002) — expect 0 rows or existing confirmations only
SELECT
  to_regclass('public.application_interview_location_confirmations') AS location_table,
  to_regclass('public.interview_schedule_days') AS schedule_days,
  to_regclass('public.interview_appointments') AS unused_appointments,
  to_regclass('public.application_interview_requests') AS requests_table;

-- 5) After 003: existing assigned slots should have published_at
-- SELECT count(*) AS assigned_slots_missing_published_at
-- FROM public.interview_slots s
-- WHERE s.published_at IS NULL
--   AND EXISTS (SELECT 1 FROM public.applications a WHERE a.interview_slot_id = s.id);

-- 6) After 004: delivery backfill for live invitations
-- SELECT count(*) AS live_assignments_unmarked
-- FROM public.applications a
-- JOIN public.interview_slots s ON s.id = a.interview_slot_id
-- WHERE a.status IN ('called_for_interview', 'interview')
--   AND s.invitation_sent_at IS NULL;

-- 7) Capacity lock functions (004)
-- SELECT proname FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN (
--     'interview_slot_occupancy',
--     'assign_interview_batch_applicants',
--     'reschedule_interview_batch_assignment'
--   );

-- 8) Unused appointment table must not hold production assignments
-- SELECT count(*) AS appointment_rows FROM public.interview_appointments;
-- SELECT count(*) AS allocations_with_appointment
-- FROM public.application_interview_allocations
-- WHERE appointment_id IS NOT NULL;
