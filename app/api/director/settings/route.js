import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

const ALLOWED_KEYS = new Set(["applications_open", "application_deadline"]);

function validateDeadline(value) {
  if (value === null || value === "") return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: "application_deadline must be an ISO string or empty" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid application_deadline" };
  // Reasonable window: not more than 5 years out
  const max = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000;
  if (d.getTime() > max) return { ok: false, error: "application_deadline is too far in the future" };
  return { ok: true, value: d.toISOString() };
}

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data, error } = await admin
    .from("site_settings")
    .select("key, value, updated_at")
    .in("key", [...ALLOWED_KEYS]);

  if (error) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return NextResponse.json({
    applications_open: map.applications_open === "true",
    application_deadline: map.application_deadline || null,
    rows: data || [],
  });
}

export async function PATCH(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const keys = Object.keys(body || {}).filter((k) => ALLOWED_KEYS.has(k));
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "No allowed settings provided. Allowed: applications_open, application_deadline" },
      { status: 400 }
    );
  }

  for (const k of Object.keys(body || {})) {
    if (!ALLOWED_KEYS.has(k)) {
      return NextResponse.json({ error: `Setting not allowed: ${k}` }, { status: 400 });
    }
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data: existing } = await admin
    .from("site_settings")
    .select("key, value")
    .in("key", keys);
  const oldMap = Object.fromEntries((existing || []).map((r) => [r.key, r.value]));

  const nowIso = new Date().toISOString();
  const updates = [];

  if ("applications_open" in body) {
    if (typeof body.applications_open !== "boolean") {
      return NextResponse.json({ error: "applications_open must be boolean" }, { status: 400 });
    }
    updates.push({
      key: "applications_open",
      value: String(body.applications_open),
      updated_at: nowIso,
    });
  }

  if ("application_deadline" in body) {
    const v = validateDeadline(body.application_deadline);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    updates.push({
      key: "application_deadline",
      value: v.value,
      updated_at: nowIso,
    });
  }

  const { error } = await admin.from("site_settings").upsert(updates, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  const newMap = Object.fromEntries(updates.map((u) => [u.key, u.value]));
  const audit = await recordDirectorAudit({
    actor: gate.profile,
    action: "settings.updated",
    entityType: "site_settings",
    entityId: keys.join(","),
    oldValue: oldMap,
    newValue: newMap,
    request,
    critical: true,
  });

  return NextResponse.json({
    success: true,
    settings: {
      applications_open:
        "applications_open" in newMap
          ? newMap.applications_open === "true"
          : oldMap.applications_open === "true",
      application_deadline:
        "application_deadline" in newMap
          ? newMap.application_deadline || null
          : oldMap.application_deadline || null,
    },
    audit_logged: audit.ok,
    audit_warning: audit.ok ? null : audit.error,
  });
}
