-- Director application count reconciliation diagnostic
-- Run in Supabase SQL Editor. Safe read-only.
-- Compare: total rows vs non-draft (operational) rows.

SELECT
  a.id,
  a.status,
  a.submitted_at,
  a.application_class_name,
  a.user_id,
  p.full_name,
  p.email,
  (a.status <> 'draft') AS in_applications_list,
  true AS in_dashboard_raw_table
FROM public.applications a
LEFT JOIN public.profiles p ON p.id = a.user_id
ORDER BY a.updated_at DESC NULLS LAST;

-- Summary counts (should match Dashboard Submitted applications / Applications All after fix)
SELECT
  count(*) FILTER (WHERE status = 'draft') AS drafts,
  count(*) FILTER (WHERE status <> 'draft') AS operational_submitted,
  count(*) AS total_rows
FROM public.applications;
