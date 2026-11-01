-- KSP interview schema compatibility audit (READ ONLY).
-- Compare live Postgres against the current batch-based interview code.
-- Do not UPDATE, DELETE, INSERT, or apply migrations with this file.
-- Do not re-run 202610300001_interview_allocation.sql.

-- 0) Migration history if Supabase CLI history is used
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20261030%'
   OR version LIKE '20261101%'
   OR name ILIKE '%interview%'
ORDER BY version;

-- 1) Table presence (tables existing != columns/functions complete)
SELECT
  t.table_name,
  to_regclass('public.' || t.table_name) IS NOT NULL AS present
FROM (VALUES
  ('interview_slots'),
  ('interview_schedules'),
  ('interview_schedule_days'),
  ('interview_schedule_breaks'),
  ('interview_appointments'),
  ('application_interview_allocations'),
  ('application_interview_location_confirmations'),
  ('application_interview_requests')
) AS t(table_name)
ORDER BY 1;

-- 2) Required columns vs live columns
WITH required(table_name, column_name, migration, requirement) AS (
  VALUES
  -- interview_slots: legacy publication table + 003 batch drafts
  ('interview_slots', 'id', 'legacy', 'required'),
  ('interview_slots', 'director_id', 'legacy', 'required'),
  ('interview_slots', 'batch_name', 'legacy', 'required'),
  ('interview_slots', 'interview_date', 'legacy', 'required'),
  ('interview_slots', 'interview_time', 'legacy', 'required'),
  ('interview_slots', 'location', 'legacy', 'required'),
  ('interview_slots', 'congratulations_message', 'legacy', 'required'),
  ('interview_slots', 'created_at', 'legacy', 'required'),
  ('interview_slots', 'status', '202608040002', 'required'),
  ('interview_slots', 'meeting_link', '202608040002', 'required'),
  ('interview_slots', 'cancelled_at', '202608040002', 'optional'),
  ('interview_slots', 'updated_at', '202608040002', 'required'),
  ('interview_slots', 'completed_at', '202608050001', 'optional'),
  ('interview_slots', 'capacity', '202611010003', 'required'),
  ('interview_slots', 'end_time', '202611010003', 'required'),
  ('interview_slots', 'schedule_day_id', '202611010003', 'required'),
  ('interview_slots', 'published_at', '202611010003', 'required'),
  ('interview_slots', 'invitation_sent_at', '202611010003', 'required'),

  -- interview_schedules
  ('interview_schedules', 'id', '202610300001', 'required'),
  ('interview_schedules', 'class_name', '202610300001', 'required'),
  ('interview_schedules', 'name', '202610300001', 'required'),
  ('interview_schedules', 'timezone', '202610300001', 'required'),
  ('interview_schedules', 'is_active', '202610300001', 'required'),
  ('interview_schedules', 'created_at', '202610300001', 'required'),
  ('interview_schedules', 'updated_at', '202610300001', 'required'),
  ('interview_schedules', 'appointment_duration_minutes', '202611010001', 'required'),
  ('interview_schedules', 'arrival_minutes', '202611010001', 'required'),
  ('interview_schedules', 'physical_venue', '202611010001', 'required'),
  ('interview_schedules', 'whatsapp_contact', '202611010001', 'required'),
  ('interview_schedules', 'physical_instructions', '202611010001', 'required'),
  ('interview_schedules', 'virtual_instructions', '202611010001', 'required'),
  ('interview_schedules', 'required_documents_physical', '202611010001', 'required'),
  ('interview_schedules', 'required_documents_virtual', '202611010001', 'required'),
  ('interview_schedules', 'policy_wording', '202611010001', 'optional'),
  ('interview_schedules', 'reschedule_policy_wording', '202611010001', 'optional'),
  ('interview_schedules', 'virtual_eligible_study_regions', '202611010002', 'required'),

  -- interview_schedule_days
  ('interview_schedule_days', 'id', '202610300001', 'required'),
  ('interview_schedule_days', 'schedule_id', '202610300001', 'required'),
  ('interview_schedule_days', 'interview_date', '202610300001', 'required'),
  ('interview_schedule_days', 'start_time', '202610300001', 'required'),
  ('interview_schedule_days', 'end_time', '202610300001', 'required'),
  ('interview_schedule_days', 'is_active', '202610300001', 'required'),
  ('interview_schedule_days', 'created_at', '202610300001', 'required'),
  ('interview_schedule_days', 'updated_at', '202610300001', 'required'),

  -- allocations
  ('application_interview_allocations', 'id', '202610300001', 'required'),
  ('application_interview_allocations', 'application_id', '202610300001', 'required'),
  ('application_interview_allocations', 'schedule_id', '202610300001', 'required'),
  ('application_interview_allocations', 'allocation_state', '202610300001', 'required'),
  ('application_interview_allocations', 'schedule_day_id', '202610300001', 'required'),
  ('application_interview_allocations', 'published_at', '202610300001', 'required'),
  ('application_interview_allocations', 'notes', '202610300001', 'optional'),
  ('application_interview_allocations', 'allocated_by', '202610300001', 'required'),
  ('application_interview_allocations', 'created_at', '202610300001', 'required'),
  ('application_interview_allocations', 'updated_at', '202610300001', 'required'),
  ('application_interview_allocations', 'appointment_id', '202611010001', 'optional'),
  ('application_interview_allocations', 'interview_format', '202611010001', 'required'),
  ('application_interview_allocations', 'meeting_link', '202611010001', 'required'),
  ('application_interview_allocations', 'meeting_instructions', '202611010001', 'optional'),
  ('application_interview_allocations', 'invitation_sent_at', '202611010001', 'required'),
  ('application_interview_allocations', 'response_status', '202611010001', 'required'),
  ('application_interview_allocations', 'interview_slot_id', '202611010003', 'required'),
  ('application_interview_allocations', 'invitation_delivery_status', '202611010004', 'required'),
  ('application_interview_allocations', 'invitation_last_error', '202611010004', 'required'),

  -- location confirmations
  ('application_interview_location_confirmations', 'id', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'application_id', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'confirmed_region', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'confirmed_town', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'source', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'confirmed_by', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'confirmed_at', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'notes', '202610300002', 'optional'),
  ('application_interview_location_confirmations', 'created_at', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'updated_at', '202610300002', 'required'),
  ('application_interview_location_confirmations', 'study_institution', '202610300002/202611010002', 'required'),
  ('application_interview_location_confirmations', 'study_region', '202610300002/202611010002', 'required'),

  -- requests
  ('application_interview_requests', 'id', '202611010001', 'required'),
  ('application_interview_requests', 'application_id', '202611010001', 'required'),
  ('application_interview_requests', 'allocation_id', '202611010001', 'optional'),
  ('application_interview_requests', 'request_type', '202611010001', 'required'),
  ('application_interview_requests', 'reason', '202611010001', 'required'),
  ('application_interview_requests', 'status', '202611010001', 'required'),
  ('application_interview_requests', 'current_appointment_id', '202611010001', 'optional'),
  ('application_interview_requests', 'replacement_appointment_id', '202611010001', 'optional'),
  ('application_interview_requests', 'decided_by', '202611010001', 'required'),
  ('application_interview_requests', 'decided_at', '202611010001', 'required'),
  ('application_interview_requests', 'director_notes', '202611010001', 'optional'),
  ('application_interview_requests', 'created_at', '202611010001', 'required'),
  ('application_interview_requests', 'updated_at', '202611010001', 'required'),
  ('application_interview_requests', 'current_interview_slot_id', '202611010003', 'required'),
  ('application_interview_requests', 'replacement_interview_slot_id', '202611010003', 'required'),
  ('application_interview_requests', 'previous_interview_date', '202611010004', 'required'),
  ('application_interview_requests', 'previous_interview_time', '202611010004', 'required'),
  ('application_interview_requests', 'new_interview_date', '202611010004', 'required'),
  ('application_interview_requests', 'new_interview_time', '202611010004', 'required'),
  ('application_interview_requests', 'notification_status', '202611010004', 'required'),
  ('application_interview_requests', 'notification_sent_at', '202611010004', 'required'),
  ('application_interview_requests', 'notification_last_error', '202611010004', 'required')
)
SELECT
  r.table_name,
  r.column_name,
  r.migration,
  r.requirement,
  (c.column_name IS NOT NULL) AS present,
  c.data_type,
  c.is_nullable
FROM required r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = r.table_name
 AND c.column_name = r.column_name
ORDER BY r.table_name, r.migration, r.column_name;

-- 3) Critical nine-item check requested in the audit
SELECT
  item,
  present
FROM (
  SELECT 'interview_slots.capacity' AS item,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interview_slots' AND column_name='capacity') AS present
  UNION ALL SELECT 'interview_slots.end_time',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interview_slots' AND column_name='end_time')
  UNION ALL SELECT 'interview_slots.published_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interview_slots' AND column_name='published_at')
  UNION ALL SELECT 'interview_slots.invitation_sent_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='interview_slots' AND column_name='invitation_sent_at')
  UNION ALL SELECT 'application_interview_allocations.interview_slot_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='application_interview_allocations' AND column_name='interview_slot_id')
  UNION ALL SELECT 'application_interview_requests.notification_status',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='application_interview_requests' AND column_name='notification_status')
  UNION ALL SELECT 'application_interview_requests.current_interview_slot_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='application_interview_requests' AND column_name='current_interview_slot_id')
  UNION ALL SELECT 'assign_interview_batch_applicants',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='assign_interview_batch_applicants')
  UNION ALL SELECT 'reschedule_interview_batch_assignment',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='reschedule_interview_batch_assignment')
) checks
ORDER BY item;

-- 4) Functions and argument names
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'interview_slot_occupancy',
    'assign_interview_batch_applicants',
    'reschedule_interview_batch_assignment'
  )
ORDER BY p.proname;

-- 5) Constraints on the live interview tables
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'interview_slots',
    'interview_schedules',
    'interview_schedule_days',
    'interview_schedule_breaks',
    'interview_appointments',
    'application_interview_allocations',
    'application_interview_location_confirmations',
    'application_interview_requests'
  )
ORDER BY c.relname, con.conname;

-- 6) Indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'interview_slots',
    'interview_schedules',
    'interview_schedule_days',
    'interview_schedule_breaks',
    'interview_appointments',
    'application_interview_allocations',
    'application_interview_location_confirmations',
    'application_interview_requests'
  )
ORDER BY tablename, indexname;

-- 7) RLS enabled + policies
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'interview_slots',
    'interview_schedules',
    'interview_schedule_days',
    'interview_schedule_breaks',
    'interview_appointments',
    'application_interview_allocations',
    'application_interview_location_confirmations',
    'application_interview_requests'
  )
ORDER BY 1;

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'interview_slots',
    'interview_schedules',
    'interview_schedule_days',
    'interview_schedule_breaks',
    'interview_appointments',
    'application_interview_allocations',
    'application_interview_location_confirmations',
    'application_interview_requests'
  )
ORDER BY tablename, policyname;

-- 8) Migration completeness scores (table exists but columns may not)
SELECT
  migration,
  count(*) FILTER (WHERE requirement = 'required') AS required_columns,
  count(*) FILTER (WHERE requirement = 'required' AND present) AS required_present,
  count(*) FILTER (WHERE requirement = 'required' AND NOT present) AS required_missing
FROM (
  WITH required(table_name, column_name, migration, requirement) AS (
    VALUES
      ('interview_slots', 'capacity', '202611010003', 'required'),
      ('interview_slots', 'end_time', '202611010003', 'required'),
      ('interview_slots', 'schedule_day_id', '202611010003', 'required'),
      ('interview_slots', 'published_at', '202611010003', 'required'),
      ('interview_slots', 'invitation_sent_at', '202611010003', 'required'),
      ('application_interview_allocations', 'interview_slot_id', '202611010003', 'required'),
      ('application_interview_requests', 'current_interview_slot_id', '202611010003', 'required'),
      ('application_interview_requests', 'replacement_interview_slot_id', '202611010003', 'required'),
      ('application_interview_allocations', 'invitation_delivery_status', '202611010004', 'required'),
      ('application_interview_allocations', 'invitation_last_error', '202611010004', 'required'),
      ('application_interview_requests', 'notification_status', '202611010004', 'required'),
      ('application_interview_requests', 'notification_sent_at', '202611010004', 'required'),
      ('application_interview_requests', 'notification_last_error', '202611010004', 'required'),
      ('application_interview_requests', 'previous_interview_date', '202611010004', 'required'),
      ('application_interview_requests', 'previous_interview_time', '202611010004', 'required'),
      ('application_interview_requests', 'new_interview_date', '202611010004', 'required'),
      ('application_interview_requests', 'new_interview_time', '202611010004', 'required'),
      ('interview_schedules', 'appointment_duration_minutes', '202611010001', 'required'),
      ('interview_schedules', 'physical_venue', '202611010001', 'required'),
      ('interview_schedules', 'virtual_eligible_study_regions', '202611010002', 'required'),
      ('application_interview_location_confirmations', 'study_institution', '202611010002', 'required'),
      ('application_interview_location_confirmations', 'study_region', '202611010002', 'required')
  )
  SELECT
    r.migration,
    r.requirement,
    (c.column_name IS NOT NULL) AS present
  FROM required r
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = r.table_name
   AND c.column_name = r.column_name
) scored
GROUP BY migration
ORDER BY migration;

-- 9) Protective counts only (no writes)
SELECT count(*) AS assigned_applications
FROM public.applications
WHERE interview_slot_id IS NOT NULL;

SELECT count(*) AS appointment_rows
FROM public.interview_appointments;

SELECT count(*) AS allocations_with_appointment_id
FROM public.application_interview_allocations
WHERE appointment_id IS NOT NULL;

SELECT count(*) AS allocations_with_slot_id
FROM public.application_interview_allocations
WHERE interview_slot_id IS NOT NULL;
