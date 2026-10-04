-- Additive seed for Stage 2 deadline (independent of Stage 1 application_deadline).
-- Default: Sunday 11 October 2026, 11:59 PM GMT / UTC.
-- Does NOT modify application_deadline, applications_open, or applicant rows.

INSERT INTO public.site_settings (key, value)
VALUES ('stage_2_deadline', '2026-10-11T23:59:00.000Z')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.site_settings IS
  'Key/value site configuration. Stage 1 uses application_deadline; Stage 2 uses stage_2_deadline.';
