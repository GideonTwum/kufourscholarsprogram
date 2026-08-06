/**
 * Director TOTP MFA helpers (Supabase Auth MFA).
 * Applicants / assessors / panel are not required to use MFA in this release.
 *
 * Enforcement is controlled by server-side DIRECTOR_MFA_REQUIRED.
 * MFA routes and TOTP code remain implemented even when enforcement is off.
 */

export const MFA_REQUIRED_CODE = "MFA_REQUIRED";
export const MFA_SETUP_PATH = "/director/mfa-setup";
export const MFA_CHALLENGE_PATH = "/director/mfa-challenge";

/**
 * Server-side feature flag. Not NEXT_PUBLIC — only trust this in proxy, RSC, and route handlers.
 * Unset or any value other than "false" → MFA required (fail closed for production).
 * DIRECTOR_MFA_REQUIRED=false → password auth sufficient for Directors (dev/staging).
 */
export function isDirectorMfaRequired() {
  const raw = process.env.DIRECTOR_MFA_REQUIRED;
  if (raw == null || String(raw).trim() === "") return true;
  return String(raw).trim().toLowerCase() !== "false";
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
 * Where an active director session should go for MFA gating.
 * When DIRECTOR_MFA_REQUIRED=false, always 'ok' (no setup/challenge redirects).
 * @returns {'ok'|'setup'|'challenge'|'error'}
 */
export async function resolveDirectorMfaDestination(supabase) {
  if (!isDirectorMfaRequired()) return "ok";

  const { verifiedTotp, error: listErr } = await listDirectorTotpFactors(supabase);
  if (listErr) return "error";
  if (!verifiedTotp.length) return "setup";

  const { currentLevel, error: aalErr } = await getDirectorAal(supabase);
  if (aalErr) return "error";
  if (currentLevel === "aal2") return "ok";
  return "challenge";
}

/**
 * Server gate: require AAL2 for privileged Director APIs when MFA enforcement is on.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ ok: true } | { ok: false, error: Response }>}
 */
export async function assertDirectorAal2(supabase) {
  if (!isDirectorMfaRequired()) return { ok: true };

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
