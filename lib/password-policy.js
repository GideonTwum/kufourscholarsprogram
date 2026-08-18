/**
 * Shared password policy for applicant registration and password reset.
 * Staff credential creation (scripts/APIs) may enforce a higher minimum.
 *
 * Passwords are never trimmed or lowercased — callers must pass the exact value
 * to Supabase Auth.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_POLICY_MESSAGE =
  "Your password does not meet the security requirements.";

export const PASSWORD_REQUIREMENT_LABELS = {
  minLength: `At least ${PASSWORD_MIN_LENGTH} characters`,
  uppercase: "One uppercase letter",
  lowercase: "One lowercase letter",
  number: "One number",
  specialCharacter: "One special character",
};

/**
 * Live checklist checks for a password string (may be empty while typing).
 * Does not mutate the input.
 *
 * @param {string} password
 * @returns {{
 *   minLength: boolean,
 *   uppercase: boolean,
 *   lowercase: boolean,
 *   number: boolean,
 *   specialCharacter: boolean,
 *   valid: boolean,
 *   metCount: number,
 * }}
 */
export function getPasswordPolicyChecks(password) {
  const value = typeof password === "string" ? password : "";
  const minLength = value.length >= PASSWORD_MIN_LENGTH;
  const uppercase = /[A-Z]/.test(value);
  const lowercase = /[a-z]/.test(value);
  const number = /[0-9]/.test(value);
  const specialCharacter = /[^A-Za-z0-9]/.test(value);
  const flags = [minLength, uppercase, lowercase, number, specialCharacter];
  const metCount = flags.filter(Boolean).length;
  const valid = metCount === flags.length;
  return {
    minLength,
    uppercase,
    lowercase,
    number,
    specialCharacter,
    valid,
    metCount,
  };
}

/**
 * @param {{ metCount?: number, valid?: boolean }} checks
 * @returns {'Weak'|'Fair'|'Strong'}
 */
export function passwordStrengthLabel(checks) {
  const met = typeof checks?.metCount === "number"
    ? checks.metCount
    : getPasswordPolicyChecks("").metCount;
  if (checks?.valid || met >= 5) return "Strong";
  if (met >= 3) return "Fair";
  return "Weak";
}

/**
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {boolean}
 */
export function passwordsMatch(password, confirmPassword) {
  return (
    typeof password === "string" &&
    typeof confirmPassword === "string" &&
    password.length > 0 &&
    password === confirmPassword
  );
}

/**
 * Submit-gate validation used by registration and reset flows.
 *
 * @param {string} password
 * @returns {{
 *   ok: boolean,
 *   message?: string,
 *   minLength: boolean,
 *   uppercase: boolean,
 *   lowercase: boolean,
 *   number: boolean,
 *   specialCharacter: boolean,
 *   valid: boolean,
 *   metCount: number,
 * }}
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== "string" || password.length === 0) {
    const empty = getPasswordPolicyChecks("");
    return {
      ok: false,
      message: "Password is required.",
      ...empty,
    };
  }

  const checks = getPasswordPolicyChecks(password);
  if (!checks.valid) {
    return {
      ok: false,
      message: PASSWORD_POLICY_MESSAGE,
      ...checks,
    };
  }

  return {
    ok: true,
    ...checks,
  };
}
