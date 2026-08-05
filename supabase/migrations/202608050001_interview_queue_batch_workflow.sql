-- Interview queue / batch workflow support (idempotent).
-- Shortlist uses status interview_review_pending + interview_shortlisted_at.
-- Batch scheduling remains via interview_slots + applications.interview_slot_id.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS interview_shortlisted_at timestamptz;

COMMENT ON COLUMN public.applications.interview_shortlisted_at IS
  'Set when Director shortlists for interview queue (unscheduled). Scheduling emails must not send until batch assignment.';

CREATE INDEX IF NOT EXISTS idx_applications_interview_queue
  ON public.applications (status, interview_slot_id, interview_shortlisted_at DESC)
  WHERE status = 'interview_review_pending';

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.interview_slots.completed_at IS
  'Set when Director marks the interview batch complete.';
