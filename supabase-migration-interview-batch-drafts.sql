-- Forward-only: draft interview_slots batches become the publication source.
-- Run in the Supabase SQL editor when approved.
-- Does NOT rewrite previously applied interview allocation SQL.
-- Does NOT drop interview_appointments or delete applicant records.
-- Do not apply to production automatically.

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS end_time text,
  ADD COLUMN IF NOT EXISTS schedule_day_id uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;

ALTER TABLE public.application_interview_allocations
  ADD COLUMN IF NOT EXISTS interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_application_interview_allocations_slot
  ON public.application_interview_allocations (interview_slot_id);

ALTER TABLE public.application_interview_requests
  ADD COLUMN IF NOT EXISTS current_interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_interview_slot_id uuid REFERENCES public.interview_slots(id) ON DELETE SET NULL;

UPDATE public.interview_slots s
SET published_at = COALESCE(s.published_at, s.updated_at, now())
WHERE s.published_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.interview_slot_id = s.id
  );
