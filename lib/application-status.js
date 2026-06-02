/** Normalize legacy / alternate status values from the database. */
export function normalizeApplicationStatus(status) {
  if (!status) return "draft";
  const map = {
    pending: "stage_1_submitted",
    stage1_submitted: "stage_1_submitted",
    under_review: "stage_1_submitted",
    shortlisted_for_stage2: "stage_1_approved",
    stage2_submitted: "stage_2_submitted",
    stage_2_review_pending: "stage_2_submitted",
  };
  return map[status] || status;
}

export const APPLICANT_PROGRESS_STEPS = [
  { key: "stage_1_submitted", label: "Stage 1 review" },
  { key: "stage_1_approved", label: "Stage 1 ✓" },
  { key: "stage_2_submitted", label: "Stage 2 review" },
  { key: "stage_2_approved", label: "Stage 2 ✓" },
  { key: "called_for_interview", label: "Interview" },
];

export function applicantProgressIndex(status) {
  if (status === "review_pending") {
    return APPLICANT_PROGRESS_STEPS.findIndex((s) => s.key === "stage_1_submitted");
  }
  if (status === "stage_2_review_pending") {
    return APPLICANT_PROGRESS_STEPS.findIndex((s) => s.key === "stage_2_submitted");
  }
  if (status === "interview_review_pending") {
    return APPLICANT_PROGRESS_STEPS.findIndex((s) => s.key === "stage_2_approved");
  }
  const normalized = normalizeApplicationStatus(status);
  if (normalized === "accepted" || normalized === "rejected") {
    return APPLICANT_PROGRESS_STEPS.length;
  }
  if (normalized === "draft") return -1;
  const i = APPLICANT_PROGRESS_STEPS.findIndex((s) => s.key === normalized);
  if (i >= 0) return i;
  if (normalized === "interview") {
    return APPLICANT_PROGRESS_STEPS.findIndex((s) => s.key === "called_for_interview");
  }
  return 0;
}

/** Copy for the read-only Stage 1 application page (/applicant/application). */
export function getApplicantApplicationView(status) {
  const views = {
    review_pending: {
      bannerClass: "bg-blue-50 text-blue-800",
      bannerText:
        "Your Stage 1 application is under review. The committee may contact you if more information is needed.",
      statusLabel: "Pending review",
      reviewTitle: "Your Stage 1 Application",
      reviewSubtitle: "Still under committee review.",
      showStage1Review: true,
    },
    stage_1_submitted: {
      bannerClass: "bg-blue-50 text-blue-800",
      bannerText:
        "Your Stage 1 application has been submitted — status Pending while the committee reviews your file.",
      statusLabel: "Pending",
      reviewTitle: "Your Stage 1 Application",
      reviewSubtitle:
        "Submitted and awaiting review. You cannot edit this while it is under review.",
      showStage1Review: true,
    },
    stage_1_approved: {
      bannerClass: "bg-green-50 text-green-800",
      bannerText:
        "Stage 1 approved. Submit your Stage 2 poster presentation video to continue.",
      statusLabel: "Stage 1 approved",
      reviewTitle: "Stage 1 Application (Approved)",
      reviewSubtitle:
        "Your Stage 1 submission was approved. Complete Stage 2 to move forward.",
      showStage1Review: true,
      cta: { href: "/applicant/stage2", label: "Continue to Stage 2" },
    },
    stage_2_review_pending: {
      bannerClass: "bg-indigo-50 text-indigo-800",
      bannerText:
        "Your Stage 2 video is under review. The committee is still evaluating your submission.",
      statusLabel: "Stage 2 in review",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "Stage 2 is still under committee review.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    stage_2_submitted: {
      bannerClass: "bg-indigo-50 text-indigo-800",
      bannerText:
        "Stage 2 submitted. Your video is in review. We will notify you when there is an update.",
      statusLabel: "Stage 2 in review",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "Stage 2 is under review. Track overall progress on your dashboard.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    interview_review_pending: {
      bannerClass: "bg-amber-50 text-amber-900",
      bannerText:
        "Stage 2 is complete. Interview scheduling is on hold while the committee reviews your file.",
      statusLabel: "Interview pending",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "The committee is still deciding on interview scheduling.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    stage_2_approved: {
      bannerClass: "bg-amber-50 text-amber-900",
      bannerText:
        "Stage 2 approved. The committee will contact you with interview details when scheduled.",
      statusLabel: "Stage 2 approved",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "Stages 1 and 2 are complete. Check your dashboard for interview updates.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    called_for_interview: {
      bannerClass: "bg-indigo-50 text-indigo-800",
      bannerText:
        "Interview stage. See your dashboard for interview date, time, and location.",
      statusLabel: "Interview",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "You have been called for an interview.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    interview: {
      bannerClass: "bg-indigo-50 text-indigo-800",
      bannerText: "Interview stage. See your dashboard for your scheduled interview.",
      statusLabel: "Interview",
      reviewTitle: "Stage 1 Application (Complete)",
      reviewSubtitle: "Interview scheduling is in progress.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    accepted: {
      bannerClass: "bg-green-50 text-green-800",
      bannerText: "Congratulations — you have been accepted into the Kufuor Scholars Program.",
      statusLabel: "Accepted",
      reviewTitle: "Your Application",
      reviewSubtitle: "You have been accepted into the program.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
    rejected: {
      bannerClass: "bg-red-50 text-red-800",
      bannerText: "Application not successful. See your dashboard for details.",
      statusLabel: "Not successful",
      reviewTitle: "Your Application",
      reviewSubtitle: "This application is closed.",
      showStage1Review: true,
      cta: { href: "/applicant", label: "View dashboard" },
    },
  };

  if (status && views[status]) return views[status];
  const s = normalizeApplicationStatus(status);
  return views[s] || views.stage_1_submitted;
}
