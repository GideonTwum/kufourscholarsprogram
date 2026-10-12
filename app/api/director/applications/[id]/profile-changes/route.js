import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIONS = [
  "applicant.profile_updated",
  "applicant.email_change_requested",
  "applicant.email_verified",
  "applicant.password_changed",
  "application.details_corrected",
];

export async function GET(_request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: application, error: appError } = await admin
    .from("applications")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (appError || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const select = "id, action, old_value, new_value, metadata, created_at, actor_name_snapshot, entity_id";
  const [onApplication, onAccount, onSiblings] = await Promise.all([
    admin.from("director_audit_events").select(select).eq("entity_id", id).in("action", ACTIONS).limit(30),
    admin
      .from("director_audit_events")
      .select(select)
      .eq("entity_id", application.user_id)
      .in("action", ACTIONS)
      .limit(30),
    admin
      .from("director_audit_events")
      .select(select)
      .contains("metadata", { application_ids: [id] })
      .in("action", ACTIONS)
      .limit(30),
  ]);

  if (onApplication.error || onAccount.error || onSiblings.error) {
    return NextResponse.json({ error: "Could not load profile changes." }, { status: 500 });
  }

  const events = new Map();
  for (const event of [...(onApplication.data || []), ...(onAccount.data || []), ...(onSiblings.data || [])]) {
    events.set(event.id, event);
  }
  const data = [...events.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const changes = [];
  for (const event of data) {
    const actor =
      event.metadata?.actor_type === "applicant" || String(event.action).startsWith("applicant.")
        ? "Applicant"
        : "Director";
    if (event.action === "applicant.password_changed") {
      changes.push({
        id: event.id,
        field: "Password",
        previous: "Hidden",
        next: "Changed",
        at: event.created_at,
        actor,
      });
      continue;
    }
    const oldValue = event.old_value || {};
    const newValue = event.new_value || {};
    const fields = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    for (const field of fields) {
      if (/password|token|secret/i.test(field)) continue;
      changes.push({
        id: `${event.id}:${field}`,
        field,
        previous: oldValue[field] ?? "—",
        next: newValue[field] ?? "—",
        at: event.created_at,
        actor,
      });
    }
  }

  return NextResponse.json({ changes });
}
