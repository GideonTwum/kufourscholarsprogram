/**
 * Assessor review workflow — recommendations only.
 * Official application status is changed only by the Director.
 */

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

/** Canonical recommendation values stored in application_assessments */
export const ASSESSOR_RECOMMENDATIONS = [
  "recommend_progress",
  "recommend_hold",
  "recommend_reject",
  "recommend_interview",
];

const LEGACY_RECOMMENDATION_MAP = {
  advance: "recommend_progress",
  hold: "recommend_hold",
  reject: "recommend_reject",
  recommend_interview: "recommend_interview",
  recommend_progress: "recommend_progress",
  recommend_hold: "recommend_hold",
  recommend_reject: "recommend_reject",
};

/** Application columns safe to return to assessors (no director/panel internals). */
export const ASSESSOR_APPLICATION_SELECT = [
  "id",
  "user_id",
  "status",
  "full_name",
  "phone",
  "date_of_birth",
  "nationality",
  "address",
  "hometown",
  "region",
  "country_of_origin",
  "university",
  "program",
  "year_of_study",
  "grade_type",
  "gpa",
  "junior_high_school",
  "senior_high_school",
  "student_id",
  "linkedin_url",
  "cv_url",
  "cv_personal_statement_url",
  "academic_transcript_url",
  "leadership_evidence_url",
  "leadership_evidence_urls",
  "recommendation_url",
  "photo_url",
  "video_youtube_url",
  "submitted_at",
  "stage_1_submitted_at",
  "stage_2_submitted_at",
  "stage2_submitted_at",
  "created_at",
  "updated_at",
].join(", ");

export const ASSESSOR_FORBIDDEN_RESPONSE_KEYS = [
  "director_notes",
  "rejection_reason",
  "internal_rejection_reason",
  "class_name",
  "interview_date",
  "interview_time",
  "interview_location",
  "interview_instructions",
];

export function assessmentStageForStatus(status) {
  if (
    ["stage_2_submitted", "stage_2_review_pending", "stage_2_approved", "interview_review_pending"].includes(
      status
    )
  ) {
    return "stage_2";
  }
  return "stage_1";
}

export function normalizeAssessorRecommendation(raw) {
  if (typeof raw !== "string") return null;
  return LEGACY_RECOMMENDATION_MAP[raw] || null;
}

/**
 * Allowed recommendations for the current stage.
 * Stage 1: progress / hold / reject
 * Stage 2: interview / hold / reject
 */
export function allowedRecommendationsForStage(stage) {
  if (stage === "stage_2") {
    return ["recommend_interview", "recommend_hold", "recommend_reject"];
  }
  return ["recommend_progress", "recommend_hold", "recommend_reject"];
}

/**
 * Suggested official status for Director review only — never applied by assessor APIs.
 * @deprecated Prefer suggestedDirectorStatusForRecommendation — kept for older tests/imports.
 */
export function nextStatusForAssessorRecommendation(stage, recommendation) {
  return suggestedDirectorStatusForRecommendation(stage, recommendation);
}

export function suggestedDirectorStatusForRecommendation(stage, recommendation) {
  const rec = normalizeAssessorRecommendation(recommendation);
  if (!rec) return null;

  if (stage === "stage_1") {
    if (rec === "recommend_progress") return "stage_1_approved";
    if (rec === "recommend_hold") return "review_pending";
    if (rec === "recommend_reject") return "rejected";
  }

  if (stage === "stage_2") {
    if (rec === "recommend_interview") return "interview_review_pending";
    if (rec === "recommend_hold") return "stage_2_review_pending";
    if (rec === "recommend_reject") return "rejected";
  }

  return null;
}

export function validateAssessmentPayload(payload, currentStatus) {
  const stage = assessmentStageForStatus(currentStatus);
  const recommendation = normalizeAssessorRecommendation(payload?.recommendation);
  const allowed = allowedRecommendationsForStage(stage);

  if (!recommendation || !allowed.includes(recommendation)) {
    return {
      error:
        stage === "stage_1"
          ? "Stage 1 recommendation must be recommend_progress, recommend_hold, or recommend_reject."
          : "Stage 2 recommendation must be recommend_interview, recommend_hold, or recommend_reject.",
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

  const suggestedStatus = suggestedDirectorStatusForRecommendation(stage, recommendation);

  return {
    stage,
    /** Never applied by assessor PATCH — Director decides */
    suggestedStatus,
    nextStatus: null,
    assessment: {
      ...scores,
      recommendation,
      overall_score: Math.round(overall * 100) / 100,
      notes: typeof payload?.notes === "string" ? payload.notes.trim() || null : null,
    },
  };
}

export function pickAssessorSafeApplication(row) {
  if (!row || typeof row !== "object") return null;
  const out = {};
  for (const key of ASSESSOR_APPLICATION_SELECT.split(",").map((s) => s.trim())) {
    if (key in row) out[key] = row[key];
  }
  if (row.profiles) {
    out.profiles = {
      full_name: row.profiles.full_name ?? null,
      email: row.profiles.email ?? null,
    };
  }
  for (const forbidden of ASSESSOR_FORBIDDEN_RESPONSE_KEYS) {
    delete out[forbidden];
  }
  return out;
}

export function assertAssessorResponseSafe(payload) {
  const json = JSON.stringify(payload);
  for (const key of ASSESSOR_FORBIDDEN_RESPONSE_KEYS) {
    if (json.includes(`"${key}"`)) {
      return `Assessor response must not include ${key}`;
    }
  }
  return null;
}
