/**
 * Append-only Director audit logging.
 * Never log passwords, tokens, or service-role keys.
 * Inserts via Admin client (bypasses RLS insert restrictions for trusted server).
 */

const SECRET_KEY_RE =
  /password|temporary_password|service_role|access_token|refresh_token|authorization|secret|api_key/i;

function scrubValue(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (typeof value === "string") {
    if (SECRET_KEY_RE.test(value) && value.length > 20) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function scrubAuditPayload(payload) {
  return scrubValue(payload);
}

/**
 * @returns {{ ok: boolean, error?: string, id?: string }}
 */
export async function recordDirectorAudit({
  actor,
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  request = null,
  critical = false,
}) {
  if (!action || !entityType) {
    return { ok: false, error: "action and entityType required" };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const row = {
      actor_id: actor?.id || actor?.user?.id || null,
      actor_name_snapshot: actor?.full_name || actor?.profile?.full_name || null,
      actor_email_snapshot: actor?.email || actor?.profile?.email || null,
      action: String(action),
      entity_type: String(entityType),
      entity_id: entityId != null ? String(entityId) : null,
      old_value: scrubAuditPayload(oldValue),
      new_value: scrubAuditPayload(newValue),
      metadata: scrubAuditPayload(metadata),
      ip_address: request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: request?.headers?.get?.("user-agent")?.slice(0, 500) || null,
    };

    const { data, error } = await admin
      .from("director_audit_events")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[director-audit] insert failed:", error.message);
      if (critical) return { ok: false, error: error.message };
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("[director-audit] error:", msg);
    return { ok: false, error: msg };
  }
}

export const DIRECTOR_AUDIT_ACTIONS = [
  "application.status_changed",
  "assessor.created",
  "assessor.deactivated",
  "assessor.reactivated",
  "assessor.deleted",
  "assessor.assigned",
  "assessor.unassigned",
  "assessor.reassigned",
  "assessor.assignment_created",
  "assessor.assignment_unassigned",
  "assessor.assignment_reassigned",
  "panel.created",
  "panel.deactivated",
  "panel.reactivated",
  "panel.deleted",
  "interview.batch_created",
  "interview.batch_updated",
  "interview.batch_cancelled",
  "interview.batch_deleted",
  "settings.updated",
  "announcement.created",
  "announcement.deleted",
  "email.test",
  "email.panel_broadcast",
  "director.deactivated",
  "director.reactivated",
];
