-- Forward-only: interview confirmation is study location, not residence.
-- Run in the Supabase SQL editor when approved.
-- Does NOT rewrite previously applied interview allocation/timetable SQL.
-- Does NOT alter applications.region, hometown, address, or status.
-- Do not apply to production automatically.

ALTER TABLE public.application_interview_location_confirmations
  ADD COLUMN IF NOT EXISTS study_institution text,
  ADD COLUMN IF NOT EXISTS study_region text;

COMMENT ON TABLE public.application_interview_location_confirmations IS
  'Confirmed study location for interview logistics: region of study, town/city of study, and current institution. Independent of Stage 1 region/hometown/address. Unconfirmed applicants have no row.';

COMMENT ON COLUMN public.application_interview_location_confirmations.confirmed_region IS
  'Region of study. Not hometown or current residential region.';

COMMENT ON COLUMN public.application_interview_location_confirmations.confirmed_town IS
  'Town or city of study. Not hometown or residential town.';

COMMENT ON COLUMN public.application_interview_location_confirmations.study_institution IS
  'Current institution of study.';

COMMENT ON COLUMN public.application_interview_location_confirmations.study_region IS
  'Region of study, kept in sync with confirmed_region.';

ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS virtual_eligible_study_regions text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.interview_schedules.virtual_eligible_study_regions IS
  'Canonical Ghana regions of study that may request a virtual interview. Empty until directors configure the approved northern list. Never auto-approves requests.';

UPDATE public.interview_schedules
SET policy_wording = 'This final stage of the recruitment process will be conducted in person. However, provision has been made for applicants currently studying in northern Ghana to request a virtual interview, subject to approval by the recruitment team.'
WHERE policy_wording IS NULL
   OR policy_wording = 'This final stage of the Kufuor Scholars Program recruitment process will be conducted in person. However, provision has been made for applicants currently studying in northern Ghana to request a virtual interview, subject to approval by the recruitment team.';
