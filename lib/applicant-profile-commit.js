/**
 * Prefer one database function so every application row, the profile
 * name/phone, and the audit row commit or roll back together.
 * If that function is not installed yet, the caller keeps the compensating path.
 */

export function isMissingProfileRpc(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code === "PGRST202" ||
    /apply_applicant_profile_correction/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find the function/i.test(message)
  );
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export async function commitApplicantProfileAtomically(admin, args) {
  const { data, error } = await admin.rpc("apply_applicant_profile_correction", {
    p_user_id: args.userId,
    p_patch: args.patch,
    p_base_updated_at: args.baseUpdatedAt,
    p_actor_name: args.actorName || null,
    p_actor_email: args.actorEmail || null,
    p_old: args.oldValue,
    p_new: args.newValue,
  });

  if (error) {
    if (isMissingProfileRpc(error)) return { available: false };
    return { available: true, ok: false, error: error.message || "Could not save your profile." };
  }

  if (data && data.ok === false && data.error === "conflict") {
    return { available: true, ok: false, conflict: true };
  }
  if (data && data.ok === false) {
    return { available: true, ok: false, error: "Could not save your profile." };
  }
  return { available: true, ok: true };
}
