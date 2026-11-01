-- Internal director-controlled interview allocation with configurable dates.
-- Additive. Does NOT alter applications.status, interview_slots, or published interviews.
-- ALREADY APPLIED in production (Supabase SQL Editor). Do not rewrite or re-run this file.
-- Later changes must be forward-only (see supabase-migration-interview-location-confirmation.sql).

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS current_town text;

COMMENT ON COLUMN public.applications.current_town IS
  'Current town/city of residence when explicitly provided. Do not infer from hometown or address.';

CREATE TABLE IF NOT EXISTS public.interview_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Accra',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_schedules_class_name_key UNIQUE (class_name)
);

CREATE TABLE IF NOT EXISTS public.interview_schedule_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.interview_schedules(id) ON DELETE CASCADE,
  interview_date date NOT NULL,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '16:00',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_schedule_days_unique_date UNIQUE (schedule_id, interview_date),
  CONSTRAINT interview_schedule_days_time_check CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.application_interview_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  schedule_id uuid NULL REFERENCES public.interview_schedules(id) ON DELETE SET NULL,
  allocation_state text NOT NULL,
  schedule_day_id uuid NULL REFERENCES public.interview_schedule_days(id) ON DELETE RESTRICT,
  published_at timestamptz NULL,
  notes text NULL,
  allocated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_interview_allocations_application_id_key UNIQUE (application_id),
  CONSTRAINT application_interview_allocations_state_check
    CHECK (allocation_state IN ('physical', 'pending_remote')),
  CONSTRAINT application_interview_allocations_day_state_check
    CHECK (
      (allocation_state = 'physical' AND schedule_day_id IS NOT NULL)
      OR
      (allocation_state = 'pending_remote' AND schedule_day_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_days_schedule_date
  ON public.interview_schedule_days (schedule_id, interview_date);
CREATE INDEX IF NOT EXISTS idx_application_interview_allocations_state_day
  ON public.application_interview_allocations (allocation_state, schedule_day_id);
CREATE INDEX IF NOT EXISTS idx_application_interview_allocations_published
  ON public.application_interview_allocations (published_at);

ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_interview_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage interview schedules" ON public.interview_schedules;
CREATE POLICY "Directors can manage interview schedules"
  ON public.interview_schedules FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Directors can manage interview schedule days" ON public.interview_schedule_days;
CREATE POLICY "Directors can manage interview schedule days"
  ON public.interview_schedule_days FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Directors can manage interview allocations"
  ON public.application_interview_allocations;
CREATE POLICY "Directors can manage interview allocations"
  ON public.application_interview_allocations FOR ALL
  USING (public.is_director()) WITH CHECK (public.is_director());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_schedule_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_interview_allocations TO authenticated;
GRANT ALL ON public.interview_schedules TO service_role;
GRANT ALL ON public.interview_schedule_days TO service_role;
GRANT ALL ON public.application_interview_allocations TO service_role;

INSERT INTO public.interview_schedules (class_name, name, timezone)
VALUES ('11th Class', '11th Class interviews', 'Africa/Accra')
ON CONFLICT (class_name) DO NOTHING;

INSERT INTO public.interview_schedule_days (schedule_id, interview_date, start_time, end_time, is_active)
SELECT s.id, d.interview_date, TIME '08:00', TIME '16:00', true
FROM public.interview_schedules s
CROSS JOIN (VALUES
  (DATE '2026-11-17'),
  (DATE '2026-11-18'),
  (DATE '2026-11-19')
) AS d(interview_date)
WHERE s.class_name = '11th Class'
ON CONFLICT (schedule_id, interview_date) DO NOTHING;
