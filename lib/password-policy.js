/**
 * Shared password policy for recovery and registration UX.
 * Staff credential creation (scripts/APIs) may enforce a higher minimum.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * @param {string} password
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== "string" || !password) {
    return { ok: false, message: "Password is required." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      ok: false,
      message: "Password must include at least one letter and one number.",
    };
  }
  return { ok: true };
}
