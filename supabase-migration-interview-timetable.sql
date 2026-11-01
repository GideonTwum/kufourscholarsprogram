-- Forward-only: configurable timetable, appointments, responses, invitation publication.
-- Run in the Supabase SQL editor when approved.
-- Does NOT rewrite 202610300001_interview_allocation.sql.
-- Does NOT alter Stage 1 hometown/address. Do not apply automatically.

ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS appointment_duration_minutes integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS arrival_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS physical_venue text,
  ADD COLUMN IF NOT EXISTS whatsapp_contact text,
  ADD COLUMN IF NOT EXISTS physical_instructions text,
  ADD COLUMN IF NOT EXISTS virtual_instructions text,
  ADD COLUMN IF NOT EXISTS required_documents_physical text,
  ADD COLUMN IF NOT EXISTS required_documents_virtual text,
  ADD COLUMN IF NOT EXISTS policy_wording text,
  ADD COLUMN IF NOT EXISTS reschedule_policy_wording text;

ALTER TABLE public.interview_schedules
  DROP CONSTRAINT IF EXISTS interview_schedules_duration_check;
ALTER TABLE public.interview_schedules
  ADD CONSTRAINT interview_schedules_duration_check
  CHECK (appointment_duration_minutes BETWEEN 1 AND 180);

ALTER TABLE public.interview_schedules
  DROP CONSTRAINT IF EXISTS interview_schedules_arrival_check;
ALTER TABLE public.interview_schedules
  ADD CONSTRAINT interview_schedules_arrival_check
  CHECK (arrival_minutes BETWEEN 0 AND 120);

CREATE TABLE IF NOT EXISTS public.interview_schedule_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_day_id uuid NOT NULL REFERENCES public.interview_schedule_days(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_schedule_breaks_time_check CHECK (end_time > start_time),
  CONSTRAINT interview_schedule_breaks_unique UNIQUE (schedule_day_id, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_breaks_day
  ON public.interview_schedule_breaks (schedule_day_id);

CREATE TABLE IF NOT EXISTS public.interview_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_day_id uuid NOT NULL REFERENCES public.interview_schedule_days(id) ON DELETE RESTRICT,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_held boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_appointments_time_check CHECK (end_time > start_time),
  CONSTRAINT interview_appointments_unique_start UNIQUE (schedule_day_id, start_time)
);

CREATE INDEX IF NOT EXISTS idx_interview_appointments_day_start
  ON public.interview_appointments (schedule_day_id, start_time);

ALTER TABLE public.application_interview_allocations
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.interview_appointments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS interview_format text NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS meeting_instructions text,
  ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_status text;

ALTER TABLE public.application_interview_allocations
  DROP CONSTRAINT IF EXISTS application_interview_allocations_format_check;
ALTER TABLE public.application_interview_allocations
  ADD CONSTRAINT application_interview_allocations_format_check
  CHECK (interview_format IN ('in_person', 'virtual'));

ALTER TABLE public.application_interview_allocations
  DROP CONSTRAINT IF EXISTS application_interview_allocations_response_check;
ALTER TABLE public.application_interview_allocations
  ADD CONSTRAINT application_interview_allocations_response_check
  CHECK (
    response_status IS NULL
    OR response_status IN (
      'awaiting_response',
      'attendance_confirmed',
      'virtual_requested',
      'reschedule_requested',
      'unable_to_attend'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS application_interview_allocations_appointment_id_key
  ON public.application_interview_allocations (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.application_interview_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  allocation_id uuid NULL REFERENCES public.application_interview_allocations(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  current_appointment_id uuid NULL REFERENCES public.interview_appointments(id) ON DELETE SET NULL,
  replacement_appointment_id uuid NULL REFERENCES public.interview_appointments(id) ON DELETE SET NULL,
  decided_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz NULL,
  director_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_interview_requests_type_check
    CHECK (request_type IN ('virtual', 'reschedule', 'unable')),
  CONSTRAINT application_interview_requests_status_check
    CHECK (status IN ('pending', 'approved', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_interview_requests_app_status
  ON public.application_interview_requests (application_id, status);

ALTER TABLE public.application_interview_location_confirmations
  ADD COLUMN IF NOT EXISTS study_institution text,
  ADD COLUMN IF NOT EXISTS study_region text;

CREATE TABLE IF NOT EXISTS public.application_interview_location_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  confirmed_region text NOT NULL,
  confirmed_town text NOT NULL,
  study_institution text,
  study_region text,
  source text NOT NULL DEFAULT 'director',
  confirmed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_interview_location_confirmations_application_id_key UNIQUE (application_id)
);

ALTER TABLE public.interview_schedule_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_interview_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_interview_location_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage interview breaks" ON public.interview_schedule_breaks;
CREATE POLICY "Directors can manage interview breaks"
  ON public.interview_schedule_breaks FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Directors can manage interview appointments" ON public.interview_appointments;
CREATE POLICY "Directors can manage interview appointments"
  ON public.interview_appointments FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Directors can manage interview requests" ON public.application_interview_requests;
CREATE POLICY "Directors can manage interview requests"
  ON public.application_interview_requests FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Applicants can read own published allocations"
  ON public.application_interview_allocations;
CREATE POLICY "Applicants can read own published allocations"
  ON public.application_interview_allocations
  FOR SELECT
  USING (
    published_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can read own published appointments"
  ON public.interview_appointments;
CREATE POLICY "Applicants can read own published appointments"
  ON public.interview_appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.application_interview_allocations al
      JOIN public.applications a ON a.id = al.application_id
      WHERE al.appointment_id = interview_appointments.id
        AND al.published_at IS NOT NULL
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can manage own interview requests"
  ON public.application_interview_requests;
CREATE POLICY "Applicants can insert own interview requests"
  ON public.application_interview_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can read own interview requests"
  ON public.application_interview_requests;
CREATE POLICY "Applicants can read own interview requests"
  ON public.application_interview_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Applicants can manage own location confirmations"
  ON public.application_interview_location_confirmations;
CREATE POLICY "Applicants can manage own location confirmations"
  ON public.application_interview_location_confirmations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_schedule_breaks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_interview_requests TO authenticated;
GRANT ALL ON public.interview_schedule_breaks TO service_role;
GRANT ALL ON public.interview_appointments TO service_role;
GRANT ALL ON public.application_interview_requests TO service_role;

INSERT INTO public.interview_schedule_breaks (schedule_day_id, start_time, end_time)
SELECT d.id, TIME '12:00', TIME '12:30'
FROM public.interview_schedule_days d
JOIN public.interview_schedules s ON s.id = d.schedule_id
WHERE s.class_name = '11th Class'
ON CONFLICT (schedule_day_id, start_time, end_time) DO NOTHING;

UPDATE public.interview_schedules
SET
  appointment_duration_minutes = COALESCE(appointment_duration_minutes, 6),
  arrival_minutes = COALESCE(arrival_minutes, 15),
  policy_wording = COALESCE(
    policy_wording,
    'This final stage of the Kufuor Scholars Program recruitment process will be conducted in person. However, provision has been made for applicants currently studying in northern Ghana to request a virtual interview, subject to approval by the recruitment team.'
  ),
  reschedule_policy_wording = COALESCE(
    reschedule_policy_wording,
    'If you have a legitimate reason why your assigned interview date or time would be unsuitable, please respond immediately to this email explaining your circumstances. You must also send a WhatsApp message to the official recruitment contact, stating your name, assigned interview date and time, and reason for requesting a change. Please note that approval of rescheduling requests is at the discretion of the recruitment team and subject to the availability of interview appointments.'
  ),
  required_documents_physical = COALESCE(
    required_documents_physical,
    'Please bring three printed copies of your CV and your WASSCE and/or NovDec examination results, as applicable.'
  ),
  required_documents_virtual = COALESCE(
    required_documents_virtual,
    'Have a digital copy of your CV and WASSCE and/or NovDec examination results available. Follow any additional document instructions provided by the recruitment team.'
  ),
  physical_instructions = COALESCE(
    physical_instructions,
    'Please arrive at least 15 minutes before your scheduled interview time.'
  ),
  virtual_instructions = COALESCE(
    virtual_instructions,
    'Please be ready and connected at least 15 minutes before your scheduled interview time.'
  )
WHERE class_name = '11th Class';
