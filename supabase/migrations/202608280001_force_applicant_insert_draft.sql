-- Launch hardening: applicants cannot INSERT applications with non-draft status.
-- Service-role / submit-stage1 (admin client) still may insert submitted/rejected rows
-- because auth.uid() is null for the service role JWT path used by createAdminClient.
--
-- Complements trg_protect_application_status_columns (UPDATE-only).

CREATE OR REPLACE FUNCTION public.force_applicant_application_insert_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass (server submit / director tooling)
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Authenticated applicants (and any non-service JWT): force draft on INSERT
  IF auth.uid() IS NOT NULL THEN
    NEW.status := 'draft';
    NEW.rejection_reason := NULL;
    NEW.submitted_at := NULL;
    NEW.stage_1_submitted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_applicant_application_insert_draft ON public.applications;
CREATE TRIGGER trg_force_applicant_application_insert_draft
  BEFORE INSERT ON public.applications
  FOR EACH ROW
  EXECUTE PROCEDURE public.force_applicant_application_insert_draft();

COMMENT ON FUNCTION public.force_applicant_application_insert_draft() IS
  'Prevents applicants from creating accepted/submitted applications via direct INSERT; service_role bypasses.';
