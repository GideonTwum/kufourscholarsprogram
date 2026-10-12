import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import {
  APPLICANT_DETAILS_CORRECTION_ACTION,
  DIRECTOR_EDITABLE_DETAIL_FIELDS,
  buildApplicantDetailsCorrection,
} from "@/lib/director-applicant-details";

const SELECT_FIELDS = "id, user_id, status, full_name, university, hometown, program, gender";

export async function PATCH(request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  const { data: current, error: loadError } = await admin
    .from("applications")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (loadError || !current) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const correction = buildApplicantDetailsCorrection(body, current);
  if (!correction.ok) {
    return NextResponse.json({ error: correction.error }, { status: correction.status });
  }

  let previousProfileName = null;
  if (correction.syncProfileName && current.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", current.user_id)
      .maybeSingle();
    previousProfileName = profile?.full_name ?? null;
  }

  const { error: updateError } = await admin
    .from("applications")
    .update(correction.patch)
    .eq("id", current.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save the correction." }, { status: 500 });
  }

  if (correction.syncProfileName && current.user_id) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: correction.patch.full_name })
      .eq("id", current.user_id);

    if (profileError) {
      await admin.from("applications").update(snapshot(current)).eq("id", current.id);
      return NextResponse.json({ error: "Could not save the correction." }, { status: 500 });
    }
  }

  const audit = await recordDirectorAudit({
    actor: gate.profile,
    action: APPLICANT_DETAILS_CORRECTION_ACTION,
    entityType: "application",
    entityId: current.id,
    oldValue: correction.oldValue,
    newValue: correction.newValue,
    metadata: {
      reason: correction.reason,
      fields: Object.keys(correction.newValue),
      user_id: current.user_id || null,
    },
    request,
    critical: true,
  });

  if (!audit.ok) {
    await admin.from("applications").update(snapshot(current)).eq("id", current.id);
    if (correction.syncProfileName && current.user_id) {
      await admin
        .from("profiles")
        .update({ full_name: previousProfileName })
        .eq("id", current.user_id);
    }
    return NextResponse.json(
      { error: "The correction could not be recorded and was not saved." },
      { status: 500 }
    );
  }

  const { data: saved } = await admin
    .from("applications")
    .select(SELECT_FIELDS)
    .eq("id", current.id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    application: saved || { id: current.id, ...correction.patch },
    changed: DIRECTOR_EDITABLE_DETAIL_FIELDS.filter((field) => field in correction.newValue),
  });
}

function snapshot(row) {
  return {
    full_name: row.full_name,
    university: row.university,
    hometown: row.hometown,
    program: row.program,
    gender: row.gender,
  };
}
