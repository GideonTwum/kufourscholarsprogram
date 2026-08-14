/**
 * Director TOTP MFA helpers — RETAINED FOR POSSIBLE FUTURE RE-ENABLEMENT ONLY.
 *
 * CURRENTLY UNUSED in the active Director authentication workflow.
 * Directors authenticate with email + password, then role=director + is_active.
 * No AAL2 / TOTP setup / challenge redirects are enforced.
 *
 * Do not wire these helpers back into proxy or requireActiveDirector without an
 * explicit product decision to restore MFA.
 */

export const MFA_REQUIRED_CODE = "MFA_REQUIRED";
export const MFA_SETUP_PATH = "/director/mfa-setup";
export const MFA_CHALLENGE_PATH = "/director/mfa-challenge";

/**
 * MFA is not required in the current Director auth flow.
 * Always returns false so retained helpers cannot re-enable enforcement accidentally
 * via DIRECTOR_MFA_REQUIRED or similar flags.
 */
export function isDirectorMfaRequired() {
  return false;
}

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
 * Unused while MFA is out of the Director flow — always 'ok'.
 * @returns {'ok'|'setup'|'challenge'|'error'}
 */
export async function resolveDirectorMfaDestination(_supabase) {
  return "ok";
}

/**
 * Unused while MFA is out of the Director flow — always allows.
 * @param {import('@supabase/supabase-js').SupabaseClient} _supabase
 * @returns {Promise<{ ok: true } | { ok: false, error: Response }>}
 */
export async function assertDirectorAal2(_supabase) {
  return { ok: true };
}
