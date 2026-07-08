export const ASSESSOR_VISIBLE_STATUSES = [
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "interview_review_pending",
  "rejected",
];

export function assessmentStageForStatus(status) {
  if (["stage_2_submitted", "stage_2_review_pending", "stage_2_approved", "interview_review_pending"].includes(status)) {
    return "stage_2";
  }
  return "stage_1";
}

export function nextStatusForAssessorRecommendation(stage, recommendation) {
  if (stage === "stage_1") {
    if (recommendation === "advance") return "stage_1_approved";
    if (recommendation === "hold") return "review_pending";
    if (recommendation === "reject") return "rejected";
  }

  if (stage === "stage_2") {
    if (recommendation === "recommend_interview") return "interview_review_pending";
    if (recommendation === "hold") return "stage_2_review_pending";
    if (recommendation === "reject") return "rejected";
  }

  return null;
}

export function validateAssessmentPayload(payload, currentStatus) {
  const stage = assessmentStageForStatus(currentStatus);
  const recommendation = payload?.recommendation;
  const nextStatus = nextStatusForAssessorRecommendation(stage, recommendation);

  if (!nextStatus) {
    return {
      error:
        stage === "stage_1"
          ? "Stage 1 recommendation must be advance, hold, or reject."
          : "Stage 2 recommendation must be recommend_interview, hold, or reject.",
    };
  }

  const scores = [
    "academic_score",
    "leadership_score",
    "service_score",
    "communication_score",
  ].reduce((acc, key) => {
    const value = Number(payload?.[key]);
    acc[key] = Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
    return acc;
  }, {});

  if (Object.values(scores).some((value) => value == null)) {
    return { error: "All scores must be whole numbers from 1 to 5." };
  }

  const overall =
    (scores.academic_score +
      scores.leadership_score +
      scores.service_score +
      scores.communication_score) /
    4;

  return {
    stage,
    nextStatus,
    assessment: {
      ...scores,
      recommendation,
      overall_score: Math.round(overall * 100) / 100,
      notes: typeof payload?.notes === "string" ? payload.notes.trim() || null : null,
    },
  };
}
