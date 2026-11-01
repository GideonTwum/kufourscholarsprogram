import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isEligibleForInterviewAllocation } from "@/lib/director-interview-allocation";
import {
  INTERVIEW_LOCATION_CONFIRMATION_TABLE,
  deleteInterviewLocationConfirmation,
  persistInterviewLocationConfirmation,
  validateInterviewLocationConfirmation,
} from "@/lib/director-interview-location";

const MISSING_TABLE = {
  error:
    "Interview location confirmation table is unavailable. Apply supabase-migration-interview-location-confirmation.sql in the SQL editor.",
  code: "LOCATION_CONFIRMATION_TABLE_MISSING",
};

function isMissingTable(error) {
  const text = String(error || "");
  return /does not exist|schema cache|PGRST205|Could not find the table/i.test(text);
}

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const applicationId = typeof body?.application_id === "string" ? body.application_id.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim() : "confirm";
  if (!applicationId) {
    return NextResponse.json({ error: "application_id required" }, { status: 400 });
  }

  const { data: application, error: loadErr } = await admin
    .from("applications")
    .select("id, status, region, current_town, hometown, address, university, interview_slot_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: "Failed to load applicant." }, { status: 500 });
  }
  if (!application) {
    return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  }
  if (!isEligibleForInterviewAllocation(application)) {
    return NextResponse.json(
      { error: "Applicant is not eligible for interview location confirmation." },
      { status: 400 }
    );
  }

  const actorId = gate.profile?.id || gate.user?.id || null;

  if (action === "unconfirm") {
    const deleted = await deleteInterviewLocationConfirmation(admin, applicationId);
    if (deleted.error) {
      const status = isMissingTable(deleted.error) ? 503 : 500;
      return NextResponse.json(status === 503 ? MISSING_TABLE : { error: deleted.error }, { status });
    }
    await recordDirectorAudit({
      actor: gate.profile,
      action: "interview_location.unconfirmed",
      entityType: INTERVIEW_LOCATION_CONFIRMATION_TABLE,
      entityId: applicationId,
      metadata: { notify_applicants: false, application_status_unchanged: true },
      request,
    });
    return NextResponse.json({
      success: true,
      confirmation: null,
      notify_applicants: false,
    });
  }

  if (action !== "confirm") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const validated = validateInterviewLocationConfirmation({
    confirmedRegion: body.confirmed_region,
    confirmedTown: body.confirmed_town,
    studyInstitution: body.study_institution,
    studyRegion: body.study_region,
    notes: body.notes,
    source: "director",
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const persisted = await persistInterviewLocationConfirmation(admin, {
    applicationId,
    validated,
    actorId,
  });
  if (persisted.error) {
    const status = isMissingTable(persisted.error) ? 503 : 500;
    return NextResponse.json(status === 503 ? MISSING_TABLE : { error: persisted.error }, { status });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview_location.confirmed",
    entityType: INTERVIEW_LOCATION_CONFIRMATION_TABLE,
    entityId: applicationId,
    newValue: {
      confirmed_region: validated.confirmed_region,
      confirmed_town: validated.confirmed_town,
      study_institution: validated.study_institution,
      study_region: validated.study_region,
    },
    metadata: { notify_applicants: false, application_status_unchanged: true },
    request,
  });

  return NextResponse.json({
    success: true,
    confirmation: persisted.confirmation,
    notify_applicants: false,
  });
}
