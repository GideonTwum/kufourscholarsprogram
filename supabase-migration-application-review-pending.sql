-- Allow "Undecided (Pending)" outcome after under_review (director triage).
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in (
    'draft',
    'stage1_submitted',
    'under_review',
    'review_pending',
    'shortlisted_for_stage2',
    'stage2_submitted',
    'interview',
    'accepted',
    'rejected'
  ));
