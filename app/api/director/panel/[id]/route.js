import { NextResponse } from "next/server";
import { requireDirectorUser, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import {
  AUTH_BAN_LONG,
  AUTH_BAN_NONE,
  deactivateProfilePayload,
  deletionBlockReason,
  reactivateProfilePayload,
} from "@/lib/staff-lifecycle";

async function loadPanelTarget(admin, id) {
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
    return NextResponse.json({ error: "Missing panel member id" }, { status: 400 });
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

  const { profile, error: loadErr } = await loadPanelTarget(admin, id);
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Panel member not found" }, { status: 404 });
  }
  if (profile.role !== "panel") {
    return NextResponse.json(
      { error: "Target account is not a panel member" },
      { status: 400 }
    );
  }

  if (action === "deactivate") {
    const { error: updErr } = await admin
      .from("profiles")
      .update(deactivateProfilePayload(gate.user.id))
      .eq("id", id)
      .eq("role", "panel");

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { error: banErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: AUTH_BAN_LONG,
    });
    if (banErr) {
      console.error("[panel deactivate] auth ban:", banErr.message);
    }

    await recordDirectorAudit({
      actor: gate.profile,
      action: "panel.deactivated",
      entityType: "profile",
      entityId: id,
      request,
    });

    return NextResponse.json({
      success: true,
      action: "deactivate",
      message: "Panel member deactivated. Login and evaluation access are blocked. History is preserved.",
    });
  }

  // reactivate
  const { error: updErr } = await admin
    .from("profiles")
    .update(reactivateProfilePayload())
    .eq("id", id)
    .eq("role", "panel");

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { error: unbanErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: AUTH_BAN_NONE,
  });
  if (unbanErr) {
    console.error("[panel reactivate] auth unban:", unbanErr.message);
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "panel.reactivated",
    entityType: "profile",
    entityId: id,
    request,
  });

  return NextResponse.json({
    success: true,
    action: "reactivate",
    message: "Panel member reactivated. They can sign in at /panel-login.",
  });
}

/**
 * Permanent delete — only when no evaluation history.
 */
export async function DELETE(_request, { params }) {
  const gate = await requireDirectorUser();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing panel member id" }, { status: 400 });
  }

  if (id === gate.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { profile, error: loadErr } = await loadPanelTarget(admin, id);
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Panel member not found" }, { status: 404 });
  }
  if (profile.role !== "panel") {
    return NextResponse.json(
      { error: "Target account is not a panel member. Permanent delete is only for panel accounts." },
      { status: 400 }
    );
  }

  const { count: evaluationCount, error: countErr } = await admin
    .from("interview_evaluations")
    .select("id", { count: "exact", head: true })
    .eq("evaluator_id", id);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  const block = deletionBlockReason({ evaluationCount: evaluationCount || 0, hasAssignments: false });
  if (block) {
    return NextResponse.json({ error: block }, { status: 409 });
  }

  // Remove roster contact by email if present
  if (profile.email) {
    await admin.from("panel_members").delete().ilike("email", profile.email);
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(id);
  if (delAuthErr) {
    return NextResponse.json(
      { error: delAuthErr.message || "Failed to delete auth user" },
      { status: 500 }
    );
  }

  // Profile may cascade from auth.users depending on project setup; ensure cleanup
  await admin.from("profiles").delete().eq("id", id);

  await recordDirectorAudit({
    actor: gate.profile,
    action: "panel.deleted",
    entityType: "profile",
    entityId: id,
    oldValue: { email: profile.email },
    request,
  });

  return NextResponse.json({
    success: true,
    action: "delete",
    message: "Panel member account permanently deleted.",
  });
}
