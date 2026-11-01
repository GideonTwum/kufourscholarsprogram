-- Forward-only: draft interview_slots batches become the publication source.
-- Does NOT rewrite 202610300001 or drop interview_appointments.
-- Does NOT delete applicant rows or assigned interview_slot_id values.
-- Do not apply to production automatically.

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS end_time text,
  ADD COLUMN IF NOT EXISTS schedule_day_id uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;

COMMENT ON COLUMN public.interview_slots.capacity IS
  'Maximum applicants for this batch. Calculated from available minutes and interview duration.';
COMMENT ON COLUMN public.interview_slots.end_time IS
  'Batch end time (Africa/Accra). interview_time remains the batch start.';
COMMENT ON COLUMN public.interview_slots.published_at IS
  'Set when directors explicitly publish the batch. Null means draft: no applicant emails.';
COMMENT ON COLUMN public.interview_slots.schedule_day_id IS
  'Optional link to configurable interview_schedule_days.';

ALTER TABLE public.application_interview_allocations
  ADD COLUMN IF NOT EXISTS interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_application_interview_allocations_slot
  ON public.application_interview_allocations (interview_slot_id);

COMMENT ON COLUMN public.application_interview_allocations.interview_slot_id IS
  'Draft or published batch assignment. Individual appointment_id is retained for compatibility but is not the publication path.';

ALTER TABLE public.application_interview_requests
  ADD COLUMN IF NOT EXISTS current_interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.application_interview_requests.current_interview_slot_id IS
  'Published interview_slots batch at the time of the request. appointment_id columns are retained.';

-- Existing assigned slots are already live publications. Do not email again.
UPDATE public.interview_slots s
SET published_at = COALESCE(s.published_at, s.updated_at, now())
WHERE s.published_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.interview_slot_id = s.id
  );
