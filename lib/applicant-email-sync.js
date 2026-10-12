/**
 * Copy a confirmed Auth email onto profiles.email.
 * Pending addresses (user.new_email / email_change) are never treated as current.
 * A repeated call after the row already matches is a no-op.
 */

import { APPLICANT_EMAIL_VERIFIED_ACTION } from "./applicant-profile.js";

export function emailChangeStillPending(user) {
  const pending = user?.new_email || user?.email_change || "";
  return typeof pending === "string" && pending.trim().length > 0;
}

export function planVerifiedEmailSync({
  authEmail,
  emailConfirmedAt,
  pendingEmail,
  profileEmail,
}) {
  const confirmed = typeof authEmail === "string" ? authEmail.trim().toLowerCase() : "";
  const pending = typeof pendingEmail === "string" ? pendingEmail.trim() : "";
  const current = typeof profileEmail === "string" ? profileEmail.trim().toLowerCase() : "";

  if (!confirmed) return { action: "skip", reason: "missing" };
  if (!emailConfirmedAt) return { action: "skip", reason: "unconfirmed" };
  if (pending) return { action: "skip", reason: "pending" };
  if (current === confirmed) return { action: "skip", reason: "unchanged" };
  return { action: "update", email: confirmed, previous: profileEmail || null };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ id: string, email?: string|null, email_confirmed_at?: string|null, new_email?: string|null, email_change?: string|null }} user
 */
export async function syncVerifiedApplicantEmail(admin, user, extras = {}) {
  if (!user?.id) return { action: "skip", reason: "missing" };

  let profileEmail = extras.profileEmail;
  let fullName = extras.fullName || null;
  if (profileEmail === undefined) {
    const { data } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profileEmail = data?.email ?? null;
    fullName = fullName || data?.full_name || null;
  }

  const plan = planVerifiedEmailSync({
    authEmail: user.email,
    emailConfirmedAt: user.email_confirmed_at,
    pendingEmail: user.new_email || user.email_change || "",
    profileEmail,
  });
  if (plan.action !== "update") {
    return { ...plan, email: profileEmail || null };
  }

  let update = admin.from("profiles").update({ email: plan.email }).eq("id", user.id);
  update =
    profileEmail == null || profileEmail === ""
      ? update.is("email", null)
      : update.eq("email", profileEmail);

  const { data, error } = await update.select("id").maybeSingle();
  if (error || !data) {
    return { action: "skip", reason: error ? "error" : "unchanged", email: profileEmail || null };
  }

  const { recordDirectorAudit } = await import("./audit/director-audit.js");
  await recordDirectorAudit({
    actor: { id: user.id, full_name: fullName, email: plan.email },
    action: APPLICANT_EMAIL_VERIFIED_ACTION,
    entityType: "profile",
    entityId: user.id,
    oldValue: { email: plan.previous },
    newValue: { email: plan.email },
    metadata: {
      actor_type: "applicant",
      application_id: extras.applicationId || null,
    },
  });

  return { action: "update", email: plan.email };
}
