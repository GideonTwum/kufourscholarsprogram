/**
 * Director triage CTAs by workflow stage.
 * Labels are stage-specific so "Accept" is never used to mean "schedule interview".
 * Official status changes remain API-enforced via STATUS_TRANSITIONS.
 */

const REJECT = {
  type: "reject",
  label: "Reject Application",
  variant: "danger",
};

function pack(config) {
  const actions = (config.actions || []).filter(Boolean);
  const primary = actions.find((a) => a.variant === "primary") || actions[0] || null;
  const pending = actions.find((a) => /keep pending/i.test(a.label || "")) || null;
  return {
    ...config,
    actions,
    primary,
    secondary: pending,
    danger: REJECT,
    accept: primary,
    pending,
    reject: REJECT,
  };
}

/**
 * @param {string} status
 * @param {{ hasInterviewDetails?: boolean }=} context
 */
export function getDirectorStageActions(status, context = {}) {
  switch (status) {
    case "stage_1_submitted":
    case "pending":
      return pack({
        stageLabel: "Stage 1 review",
        helperText: "Approve Stage 1 to invite Stage 2, or defer / reject.",
        actions: [
          { type: "status", next: "stage_1_approved", label: "Approve Stage 1", variant: "primary" },
          { type: "status", next: "review_pending", label: "Keep Pending", variant: "secondary" },
          REJECT,
        ],
      });

    case "review_pending":
      return pack({
        stageLabel: "Stage 1 review",
        helperText: "This application is deferred in Stage 1 review.",
        deferred: true,
        actions: [
          { type: "status", next: "stage_1_approved", label: "Approve Stage 1", variant: "primary" },
          {
            type: "status",
            next: "stage_1_submitted",
            label: "Keep Pending",
            hint: "Moves back to the active Stage 1 review queue.",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    case "stage_1_approved":
      return pack({
        stageLabel: "Awaiting Stage 2 submission",
        helperText: "Applicant must submit Stage 2 before you can continue.",
        actions: [
          {
            type: "disabled",
            label: "Approve Stage 2",
            reason: "Applicant must submit Stage 2 before you can approve this step.",
            variant: "primary",
          },
          {
            type: "status",
            next: "review_pending",
            label: "Keep Pending",
            hint: "Pause and revisit Stage 1 review.",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    case "stage_2_submitted":
      return pack({
        stageLabel: "Stage 2 review",
        helperText: "Approve Stage 2 to move into interview scheduling.",
        actions: [
          { type: "status", next: "stage_2_approved", label: "Approve Stage 2", variant: "primary" },
          { type: "status", next: "stage_2_review_pending", label: "Keep Pending", variant: "secondary" },
          REJECT,
        ],
      });

    case "stage_2_review_pending":
      return pack({
        stageLabel: "Stage 2 review",
        helperText: "This application is deferred in Stage 2 review.",
        deferred: true,
        actions: [
          { type: "status", next: "stage_2_approved", label: "Approve Stage 2", variant: "primary" },
          {
            type: "status",
            next: "stage_2_submitted",
            label: "Keep Pending",
            hint: "Moves back to the active Stage 2 review queue.",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    case "stage_2_approved":
      return pack({
        stageLabel: "Interview shortlist",
        helperText:
          "Move this applicant to the interview queue. Date and time will be assigned from the Interviews page.",
        actions: [
          {
            type: "status",
            next: "interview_review_pending",
            label: "Shortlist for Interview",
            hint: "Adds the applicant to the unscheduled interview queue. Does not send a date/time email.",
            variant: "primary",
          },
          {
            type: "noop",
            label: "Keep Pending",
            hint: "Leaves the applicant at Stage 2 approved without shortlisting.",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    case "interview_review_pending":
      return pack({
        stageLabel: "Interview queue",
        helperText:
          "This applicant is shortlisted and waiting for a batch schedule on the Interviews page.",
        deferred: true,
        actions: [
          {
            type: "href",
            href: "/director/interviews",
            label: "Go to Interview Scheduling",
            variant: "primary",
          },
          {
            type: "status",
            next: "stage_2_approved",
            label: "Remove from Interview Queue",
            hint: "Returns the applicant to Stage 2 approved (not shortlisted).",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    case "called_for_interview": {
      const hasDetails = context.hasInterviewDetails !== false;
      return pack({
        stageLabel: "Interview scheduled",
        helperText:
          "Interview details were assigned from a batch. Mark complete after the panel session before final programme acceptance.",
        actions: [
          {
            type: "status",
            next: "interview",
            label: "Mark Interview Complete",
            hint: "Moves the file to post-interview final review. Does not accept into the programme.",
            variant: "primary",
          },
          hasDetails
            ? { type: "view_interview", label: "View Interview", variant: "neutral" }
            : null,
          {
            type: "href",
            href: "/director/interviews",
            label: "Manage Batches",
            variant: "neutral",
          },
          {
            type: "status",
            next: "interview_review_pending",
            label: "Keep Pending",
            hint: "Returns the applicant to the unscheduled interview queue.",
            variant: "secondary",
          },
          REJECT,
        ],
      });
    }

    case "interview":
      return pack({
        stageLabel: "Final programme review",
        helperText:
          "Panel scoring is available. Accept into the programme only after you are satisfied with the interview outcome.",
        actions: [
          {
            type: "accept_modal",
            label: "Accept into Programme",
            hint: "Final scholarship acceptance. Requires selecting a cohort class.",
            variant: "primary",
          },
          {
            type: "href",
            href: "/director/interviews",
            label: "Review Interview Batches",
            variant: "neutral",
          },
          {
            type: "status",
            next: "interview_review_pending",
            label: "Keep Pending",
            variant: "secondary",
          },
          REJECT,
        ],
      });

    default:
      return null;
  }
}

export function isInterviewSchedulingStage(status) {
  return status === "stage_2_approved" || status === "interview_review_pending";
}

export function isInterviewQueueStatus(status) {
  return status === "interview_review_pending";
}

export function isInterviewScheduledStage(status) {
  return status === "called_for_interview" || status === "interview";
}

export function showsShortlistForInterviewCta(config) {
  return (config?.actions || []).some(
    (a) => a.type === "status" && /^shortlist for interview$/i.test(a.label || "")
  );
}

export function showsScheduleInterviewCta(config) {
  return (config?.actions || []).some(
    (a) => a.type === "interview_modal" && /^schedule interview$/i.test(a.label || "")
  );
}

export function showsFinalProgrammeAccept(config) {
  return (config?.actions || []).some((a) => a.type === "accept_modal");
}

export function showsAmbiguousAcceptLabel(config) {
  return (config?.actions || []).some((a) => /^accept$/i.test((a.label || "").trim()));
}
