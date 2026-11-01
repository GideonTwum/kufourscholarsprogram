-- Forward-only: interview study-location confirmation.
-- Additive. Does NOT alter applications.status, interview_slots, allocations, or Stage 1 region/hometown/address.
-- confirmed_region / confirmed_town store region and town/city of STUDY, not residence.
-- Do not rewrite 202610300001_interview_allocation.sql.
-- Do not apply to production automatically.
-- If this file was already applied without study_institution, also apply 202611010002_interview_study_location.sql.

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
  CONSTRAINT application_interview_location_confirmations_application_id_key UNIQUE (application_id),
  CONSTRAINT application_interview_location_confirmations_source_check
    CHECK (source IN ('director', 'applicant')),
  CONSTRAINT application_interview_location_confirmations_region_check
    CHECK (length(btrim(confirmed_region)) > 0),
  CONSTRAINT application_interview_location_confirmations_town_check
    CHECK (length(btrim(confirmed_town)) > 0)
);

COMMENT ON TABLE public.application_interview_location_confirmations IS
  'Confirmed study location for interview logistics: region of study, town/city of study, and current institution. Independent of Stage 1 region/hometown/address. Unconfirmed applicants have no row.';

CREATE INDEX IF NOT EXISTS idx_interview_location_confirmations_region_town
  ON public.application_interview_location_confirmations (confirmed_region, confirmed_town);

ALTER TABLE public.application_interview_location_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage interview location confirmations"
  ON public.application_interview_location_confirmations;
CREATE POLICY "Directors can manage interview location confirmations"
  ON public.application_interview_location_confirmations
  FOR ALL
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- No applicant SELECT policies: confirmation stays director-only in v1.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_interview_location_confirmations TO authenticated;
GRANT ALL ON public.application_interview_location_confirmations TO service_role;
