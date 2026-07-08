export const VALID_APPLICATION_STATUSES = [
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
  "accepted",
  "rejected",
];

export function validateStatusUpdateInput(body) {
  const status = body?.status;

  if (!VALID_APPLICATION_STATUSES.includes(status)) {
    return "Invalid status";
  }

  if (status === "accepted" && !body?.class_name?.trim?.()) {
    return "class_name is required when accepting an applicant";
  }

  if (status === "called_for_interview") {
    const interview = body?.interview;
    if (
      !interview?.interview_date ||
      !interview?.interview_time?.trim?.() ||
      !interview?.interview_location?.trim?.()
    ) {
      return "Interview date, time, and location (or meeting link) are required.";
    }
  }

  return null;
}
