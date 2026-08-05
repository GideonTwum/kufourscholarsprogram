/**
 * Director TOTP MFA helpers (Supabase Auth MFA).
 * Applicants / assessors / panel are not required to use MFA in this release.
 */

export const MFA_REQUIRED_CODE = "MFA_REQUIRED";
export const MFA_SETUP_PATH = "/director/mfa-setup";
export const MFA_CHALLENGE_PATH = "/director/mfa-challenge";

export function mfaRequiredResponse(message = "Multi-factor authentication is required.") {
  return Response.json(
    { error: message, code: MFA_REQUIRED_CODE },
    { status: 403 }
  );
}

export function isDirectorMfaPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  return (
    pathname === MFA_SETUP_PATH ||
    pathname.startsWith(`${MFA_SETUP_PATH}/`) ||
    pathname === MFA_CHALLENGE_PATH ||
    pathname.startsWith(`${MFA_CHALLENGE_PATH}/`)
  );
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ currentLevel: string|null, nextLevel: string|null, error: Error|null }>}
 */
export async function getDirectorAal(supabase) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    currentLevel: data?.currentLevel ?? null,
    nextLevel: data?.nextLevel ?? null,
    error: error || null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ verifiedTotp: object[], allTotp: object[], error: Error|null }>}
 */
export async function listDirectorTotpFactors(supabase) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  const allTotp = Array.isArray(data?.totp) ? data.totp : [];
  const verifiedTotp = allTotp.filter((f) => f?.status === "verified");
  return { verifiedTotp, allTotp, error: error || null };
}

/**
 * Where an active director session should go for MFA gating.
 * @returns {'ok'|'setup'|'challenge'|'error'}
 */
export async function resolveDirectorMfaDestination(supabase) {
  const { verifiedTotp, error: listErr } = await listDirectorTotpFactors(supabase);
  if (listErr) return "error";
  if (!verifiedTotp.length) return "setup";

  const { currentLevel, error: aalErr } = await getDirectorAal(supabase);
  if (aalErr) return "error";
  if (currentLevel === "aal2") return "ok";
  return "challenge";
}

/**
 * Server gate: require AAL2 for privileged Director APIs.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ ok: true } | { ok: false, error: Response }>}
 */
export async function assertDirectorAal2(supabase) {
  const { currentLevel, error } = await getDirectorAal(supabase);
  if (error) {
    return {
      ok: false,
      error: Response.json(
        { error: "Unable to verify multi-factor status.", code: MFA_REQUIRED_CODE },
        { status: 403 }
      ),
    };
  }
  if (currentLevel !== "aal2") {
    return { ok: false, error: mfaRequiredResponse() };
  }
  return { ok: true };
}
