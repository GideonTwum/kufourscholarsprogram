import { requireActiveAssessor, getAdminOrError } from "@/lib/director-auth";
import {
  ASSESSOR_APPLICATION_SELECT,
  pickAssessorSafeApplication,
  assertAssessorResponseSafe,
} from "@/lib/assessor-workflow";
import { NextResponse } from "next/server";

function safeDbError(error) {
  if (!error) return null;
  return {
    code: error.code || null,
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
  };
}

function fail(message, status, error) {
  const body = { error: message };
  if (process.env.NODE_ENV === "development") {
    body.debug = safeDbError(error);
  }
  if (error) {
    console.error("[assessor/applications]", message, safeDbError(error));
  }
  return NextResponse.json(body, { status });
}

/**
 * GET — active assignments for the authenticated assessor only.
 * Uses Admin client AFTER requireActiveAssessor; always filters by assessor_id.
 */
export async function GET() {
  const gate = await requireActiveAssessor();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;
  const assessorId = gate.user.id;

  const { data: assignments, error: assignErr } = await admin
    .from("assessor_assignments")
    .select("id, status, assigned_at, application_id")
    .eq("assessor_id", assessorId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  if (assignErr) {
    return fail("Applications could not be loaded. Please retry.", 500, assignErr);
  }

  const applicationIds = (assignments || []).map((row) => row.application_id).filter(Boolean);
  if (applicationIds.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  const { data: applications, error: appError } = await admin
    .from("applications")
    .select(ASSESSOR_APPLICATION_SELECT)
    .in("id", applicationIds);

  if (appError) {
    return fail("Applications could not be loaded. Please retry.", 500, appError);
  }

  const userIds = [...new Set((applications || []).map((app) => app.user_id).filter(Boolean))];
  const { data: profiles, error: profErr } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [], error: null };

  if (profErr) {
    return fail("Applications could not be loaded. Please retry.", 500, profErr);
  }

  const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const applicationsById = Object.fromEntries((applications || []).map((app) => [app.id, app]));

  const { data: myAssessments, error: assessErr } = await admin
    .from("application_assessments")
    .select("application_id, stage, recommendation, submitted_at, updated_at, overall_score")
    .eq("assessor_id", assessorId)
    .in("application_id", applicationIds);

  if (assessErr) {
    return fail("Applications could not be loaded. Please retry.", 500, assessErr);
  }

  const assessmentByApp = {};
  for (const row of myAssessments || []) {
    assessmentByApp[row.application_id] = row;
  }

  const payload = (assignments || []).map((row) => {
    const app = applicationsById[row.application_id];
    const profile = profilesById[app?.user_id] || null;
    const safe = pickAssessorSafeApplication({
      ...(app || {}),
      profiles: profile,
    });
    const assessment = assessmentByApp[row.application_id] || null;
    const item = {
      id: safe.id || row.application_id,
      assignment: {
        id: row.id,
        status: row.status,
        assigned_at: row.assigned_at,
      },
      application: {
        id: safe.id || row.application_id,
        status: safe.status || null,
        submitted_at: safe.submitted_at || null,
        university: safe.university || null,
        full_name: safe.full_name || profile?.full_name || null,
        applicant: {
          id: app?.user_id || null,
          full_name: profile?.full_name || safe.full_name || null,
          email: profile?.email || null,
        },
      },
      assessment: assessment
        ? {
            status: "submitted",
            recommendation: assessment.recommendation || null,
            submitted_at: assessment.submitted_at || null,
            overall_score: assessment.overall_score ?? null,
            stage: assessment.stage || null,
          }
        : {
            status: "pending",
            recommendation: null,
            submitted_at: null,
            overall_score: null,
            stage: null,
          },
      // Flat fields kept for existing detail links / name helpers
      assignment_id: row.id,
      assigned_at: row.assigned_at,
      assignment_status: row.status,
      has_assessment: Boolean(assessment),
      my_assessment: assessment,
      ...safe,
      profiles: profile,
    };
    assertAssessorResponseSafe(item);
    return item;
  });

  return NextResponse.json({ applications: payload });
}
