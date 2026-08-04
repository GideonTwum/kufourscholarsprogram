import { NextResponse } from "next/server";
import { requireDirectorUser, getAdminOrError } from "@/lib/director-auth";
import {
  AUTH_BAN_LONG,
  AUTH_BAN_NONE,
  deactivateProfilePayload,
  assessorDeletionBlockReason,
  reactivateProfilePayload,
} from "@/lib/staff-lifecycle";
import { sendKspEmail } from "@/lib/email/send";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

async function loadAssessorTarget(admin, id) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active, deactivated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error };
  return { profile: data };
}

/**
 * PATCH { action: "deactivate" | "reactivate" }
 */
export async function PATCH(request, { params }) {
  const gate = await requireDirectorUser();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing assessor id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body?.action;
  if (action !== "deactivate" && action !== "reactivate") {
    return NextResponse.json({ error: "action must be deactivate or reactivate" }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { profile, error: loadErr } = await loadAssessorTarget(admin, id);
  if (loadErr) {
    return NextResponse.json({ error: "Failed to load assessor" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Assessor not found" }, { status: 404 });
  }
  if (profile.role !== "assessor") {
    return NextResponse.json({ error: "Target account is not an assessor" }, { status: 400 });
  }

  if (action === "deactivate") {
    const { error: updErr } = await admin
      .from("profiles")
      .update(deactivateProfilePayload(gate.user.id))
      .eq("id", id)
      .eq("role", "assessor");

    if (updErr) {
      return NextResponse.json({ error: "Failed to deactivate assessor" }, { status: 500 });
    }

    const { error: banErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: AUTH_BAN_LONG,
    });
    if (banErr) {
      console.error("[assessor deactivate] auth ban:", banErr.message);
    }

    if (profile.email) {
      await sendKspEmail({
        event: "assessor_deactivated",
        to: profile.email,
        subject: "Kufuor Scholars — assessor account deactivated",
        html: `<p>Your assessor account has been deactivated. You can no longer sign in or receive new assignments. Contact the program director if you need access restored.</p>`,
        text: `Your assessor account has been deactivated. You can no longer sign in or receive new assignments.`,
        template: "assessor_deactivated",
        directorId: gate.user.id,
      });
    }

    await recordDirectorAudit({
      actor: gate.profile,
      action: "assessor.deactivated",
      entityType: "profile",
      entityId: id,
      request,
    });

    return NextResponse.json({
      success: true,
      action: "deactivate",
      message:
        "Assessor deactivated. Login and new assignments are blocked. Assignment and assessment history are preserved.",
    });
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update(reactivateProfilePayload())
    .eq("id", id)
    .eq("role", "assessor");

  if (updErr) {
    return NextResponse.json({ error: "Failed to reactivate assessor" }, { status: 500 });
  }

  const { error: unbanErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: AUTH_BAN_NONE,
  });
  if (unbanErr) {
    console.error("[assessor reactivate] auth unban:", unbanErr.message);
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.reactivated",
    entityType: "profile",
    entityId: id,
    request,
  });

  return NextResponse.json({
    success: true,
    action: "reactivate",
    message: "Assessor reactivated. They can sign in at /assessor-login.",
  });
}

/**
 * Permanent delete — only when no assignments and no assessments.
 */
export async function DELETE(_request, { params }) {
  const gate = await requireDirectorUser();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing assessor id" }, { status: 400 });
  }

  if (id === gate.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { profile, error: loadErr } = await loadAssessorTarget(admin, id);
  if (loadErr) {
    return NextResponse.json({ error: "Failed to load assessor" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Assessor not found" }, { status: 404 });
  }
  if (profile.role !== "assessor") {
    return NextResponse.json(
      { error: "Target account is not an assessor. Permanent delete is only for assessor accounts." },
      { status: 400 }
    );
  }

  const [{ count: assessmentCount, error: aErr }, { count: assignmentCount, error: bErr }] =
    await Promise.all([
      admin
        .from("application_assessments")
        .select("id", { count: "exact", head: true })
        .eq("assessor_id", id),
      admin
        .from("assessor_assignments")
        .select("id", { count: "exact", head: true })
        .eq("assessor_id", id),
    ]);

  if (aErr || bErr) {
    return NextResponse.json({ error: "Failed to check assessor history" }, { status: 500 });
  }

  const block = assessorDeletionBlockReason({
    assessmentCount: assessmentCount || 0,
    assignmentCount: assignmentCount || 0,
  });
  if (block) {
    return NextResponse.json({ error: block }, { status: 409 });
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(id);
  if (delAuthErr) {
    return NextResponse.json(
      { error: delAuthErr.message || "Failed to delete auth user" },
      { status: 500 }
    );
  }

  await admin.from("profiles").delete().eq("id", id);

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.deleted",
    entityType: "profile",
    entityId: id,
    oldValue: { email: profile.email },
    request,
  });

  return NextResponse.json({
    success: true,
    action: "delete",
    message: "Assessor account permanently deleted.",
  });
}
