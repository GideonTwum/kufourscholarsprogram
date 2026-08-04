-- Director security & operations: audit log, interview lifecycle, announcement audiences.
-- Idempotent. Apply AFTER (in order):
--   202608030001_production_hardening.sql
--   202608030002_four_portal_roles.sql
--   202608030003_panel_account_lifecycle.sql
--   202608040001_assessor_account_lifecycle_and_governance.sql
-- Then this file: 202608040002_director_security_operations.sql
--
-- Auth ban/unban remains in server Admin API / developer scripts (not SQL).

-- ---------------------------------------------------------------------------
-- 1) Shared lifecycle columns (no-op if present)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles
SET is_active = true
WHERE role = 'director' AND is_active IS DISTINCT FROM true;

-- ---------------------------------------------------------------------------
-- 2) Append-only director_audit_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.director_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot text NULL,
  actor_email_snapshot text NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  metadata jsonb NULL,
  ip_address text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_director_audit_created_at
  ON public.director_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_director_audit_actor
  ON public.director_audit_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_director_audit_entity
  ON public.director_audit_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_director_audit_action
  ON public.director_audit_events (action);

ALTER TABLE public.director_audit_events ENABLE ROW LEVEL SECURITY;

-- Active directors may read; inserts via service role only (no INSERT policy for authenticated)
DROP POLICY IF EXISTS "Active directors can read audit events" ON public.director_audit_events;
CREATE POLICY "Active directors can read audit events"
  ON public.director_audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'director'
        AND COALESCE(p.is_active, true) = true
    )
  );

-- Explicitly no UPDATE/DELETE policies for authenticated roles

-- ---------------------------------------------------------------------------
-- 3) Interview slot lifecycle fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.interview_slots
SET status = 'scheduled'
WHERE status IS NULL;

ALTER TABLE public.interview_slots
  ALTER COLUMN status SET DEFAULT 'scheduled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.interview_slots'::regclass
      AND conname = 'interview_slots_status_check'
  ) THEN
    ALTER TABLE public.interview_slots
      ADD CONSTRAINT interview_slots_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS meeting_link text NULL;

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL;

ALTER TABLE public.interview_slots
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_interview_slots_status_date
  ON public.interview_slots (status, interview_date);

-- One active interview slot assignment per application (when slot set)
-- (applications.interview_slot_id already single FK)

-- ---------------------------------------------------------------------------
-- 4) Announcement audience canonicalization
-- ---------------------------------------------------------------------------
UPDATE public.announcements
SET audience = CASE audience
  WHEN 'all' THEN 'all_applicants'
  WHEN 'pending' THEN 'stage_1_submitted'
  WHEN 'under_review' THEN 'stage_1_submitted'
  WHEN 'submitted' THEN 'stage_1_submitted'
  WHEN 'shortlisted' THEN 'stage_1_approved'
  WHEN 'interview' THEN 'called_for_interview'
  ELSE audience
END
WHERE audience IN ('all', 'pending', 'under_review', 'submitted', 'shortlisted', 'interview');

COMMENT ON TABLE public.director_audit_events IS
  'Append-only privileged Director actions. Insert via service role only.';
