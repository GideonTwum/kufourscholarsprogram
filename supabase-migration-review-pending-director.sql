-- Director "defer for later" statuses (run in Supabase SQL Editor)

alter table public.applications drop constraint if exists applications_status_check;

alter table public.applications add constraint applications_status_check
  check (status in (
    'draft',
    'stage_1_submitted',
    'review_pending',
    'stage_1_approved',
    'stage_2_submitted',
    'stage_2_review_pending',
    'stage_2_approved',
    'interview_review_pending',
    'called_for_interview',
    'interview',
    'accepted',
    'rejected'
  ));
