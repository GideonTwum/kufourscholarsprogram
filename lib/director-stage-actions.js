/**
 * Director triage at each pipeline stage: Accept (advance), Pending (defer), Reject.
 * Returns null for terminal statuses.
 */
export function getDirectorStageActions(status) {
  const reject = { type: "reject" };

  switch (status) {
    case "stage_1_submitted":
    case "pending":
      return {
        stageLabel: "Stage 1 review",
        accept: { type: "status", next: "stage_1_approved", label: "Accept" },
        pending: { type: "status", next: "review_pending", label: "Pending" },
        reject,
      };

    case "review_pending":
      return {
        stageLabel: "Stage 1 review",
        accept: { type: "status", next: "stage_1_approved", label: "Accept" },
        pending: {
          type: "status",
          next: "stage_1_submitted",
          label: "Pending",
          hint: "Moves back to the active Stage 1 review queue.",
        },
        reject,
        deferred: true,
      };

    case "stage_1_approved":
      return {
        stageLabel: "Awaiting Stage 2 submission",
        accept: {
          type: "disabled",
          label: "Accept",
          reason: "Applicant must submit Stage 2 before you can accept this step.",
        },
        pending: {
          type: "status",
          next: "review_pending",
          label: "Pending",
          hint: "Pause and revisit Stage 1 review.",
        },
        reject,
      };

    case "stage_2_submitted":
      return {
        stageLabel: "Stage 2 review",
        accept: { type: "status", next: "stage_2_approved", label: "Accept" },
        pending: { type: "status", next: "stage_2_review_pending", label: "Pending" },
        reject,
      };

    case "stage_2_review_pending":
      return {
        stageLabel: "Stage 2 review",
        accept: { type: "status", next: "stage_2_approved", label: "Accept" },
        pending: {
          type: "status",
          next: "stage_2_submitted",
          label: "Pending",
          hint: "Moves back to the active Stage 2 review queue.",
        },
        reject,
        deferred: true,
      };

    case "stage_2_approved":
      return {
        stageLabel: "Interview scheduling",
        accept: {
          type: "interview_modal",
          label: "Accept",
          hint: "Schedule interview (required before final program acceptance).",
        },
        pending: { type: "status", next: "interview_review_pending", label: "Pending" },
        reject,
      };

    case "interview_review_pending":
      return {
        stageLabel: "Interview scheduling",
        accept: { type: "interview_modal", label: "Accept" },
        pending: {
          type: "status",
          next: "stage_2_approved",
          label: "Pending",
          hint: "Returns to ready-for-interview queue.",
        },
        reject,
        deferred: true,
      };

    case "called_for_interview":
    case "interview":
      return {
        stageLabel: "Interview & final decision",
        accept: { type: "accept_modal", label: "Accept" },
        pending: { type: "status", next: "interview_review_pending", label: "Pending" },
        reject,
      };

    default:
      return null;
  }
}
