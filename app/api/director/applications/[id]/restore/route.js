import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";
import {
  APPLICATION_RESTORE_ACTION,
  DIRECTOR_RESTORE_SELECT,
  buildRejectedRestorePatch,
  previousStatusFromAuditEvents,
  resolveRejectedRestoreTarget,
  validateRestoreConfirmation,
} from "@/lib/director-application-restore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadAllocation(admin, applicationId) {
  const { data, error } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select("application_id, interview_slot_id")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) {
    // Missing allocation table should not block restore of non-interview apps.
    if (error.code === "42P01" || /does not exist/i.test(error.message || "")) return null;
    return { __error: error };
  }
  return data || null;
}

async function loadPreviousStatus(admin, applicationId) {
  const { data, error } = await admin
    .from("director_audit_events")
    .select("action, old_value, new_value, created_at")
    .eq("entity_type", "application")
    .eq("entity_id", applicationId)
    .in("action", ["application.status_changed", "application.shortlisted_for_interview"])
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return null;
  return previousStatusFromAuditEvents(data || []);
}

export async function POST(request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing application id." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const confirmation = validateRestoreConfirmation(body);
  if (!confirmation.ok) {
    return NextResponse.json({ error: confirmation.error }, { status: confirmation.statusCode });
  }

  const { data: application, error: loadError } = await admin
    .from("applications")
    .select(DIRECTOR_RESTORE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const allocation = await loadAllocation(admin, id);
  if (allocation?.__error) {
    return NextResponse.json({ error: "Could not verify interview assignment state." }, { status: 500 });
  }

  const previousStatus = await loadPreviousStatus(admin, id);
  const resolved = resolveRejectedRestoreTarget(application, {
    previousStatus,
    allocation,
  });
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code || null },
      { status: resolved.statusCode || 409 }
    );
  }

  const built = buildRejectedRestorePatch(application, resolved.status, {
    reason: typeof body.reason === "string" ? body.reason : "",
  });
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.statusCode || 400 });
  }

  // Atomic compare-and-set: only restore while still rejected.
  const { data: updated, error: updateError } = await admin
    .from("applications")
    .update(built.patch)
    .eq("id", id)
    .eq("status", "rejected")
    .select("id, status, full_name, rejection_reason, updated_at")
    .maybeSingle();

  if (updateError) {
    console.error("[director-application-restore] update failed", {
      code: updateError.code || null,
      message: updateError.message || null,
    });
    return NextResponse.json({ error: "Could not restore this application." }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      {
        error: "This application is no longer rejected, so it cannot be restored again.",
        code: "already_restored",
      },
      { status: 409 }
    );
  }

  const audit = await recordDirectorAudit({
    actor: gate.profile,
    action: APPLICATION_RESTORE_ACTION,
    entityType: "application",
    entityId: id,
    oldValue: built.oldValue,
    newValue: {
      ...built.newValue,
      determination_source: resolved.source || null,
      previous_status_from_audit: previousStatus || null,
    },
    metadata: built.metadata,
    request,
    critical: true,
  });

  console.info("[director-application-restore]", {
    application_id: id,
    from: "rejected",
    to: updated.status,
    source: resolved.source || null,
    audit_ok: audit.ok,
  });

  return NextResponse.json({
    ok: true,
    application: updated,
    previous_status: "rejected",
    restored_status: updated.status,
    determination_source: resolved.source || null,
    mutates_assessments: false,
    mutates_interview_assignments: false,
    sends_notifications: false,
    audit_logged: audit.ok,
    audit_warning: audit.ok ? null : audit.error,
  });
}
