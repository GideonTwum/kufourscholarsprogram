/** Shared validation helpers for Director Sign Up (client + API-safe patterns). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LENGTH = {
  fullName: 160,
  phone: 32,
  email: 254,
  code: 128,
};

export function sanitizeDirectorSignupInput(raw) {
  const fullName =
    typeof raw.fullName === "string"
      ? raw.fullName.trim().slice(0, LENGTH.fullName)
      : "";
  const emailRaw = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const email = emailRaw.slice(0, LENGTH.email);
  const phoneDigits =
    typeof raw.phone === "string" ? raw.phone.trim().slice(0, LENGTH.phone) : "";
  const phone = sanitizePhone(phoneDigits);
  const directorCode =
    typeof raw.directorCode === "string" ? raw.directorCode.trim().slice(0, LENGTH.code) : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const confirmPassword = typeof raw.confirmPassword === "string" ? raw.confirmPassword : "";
  return { fullName, email, phone, directorCode, password, confirmPassword };
}

/** Allow common phone characters; collapse weird whitespace */
export function sanitizePhone(s) {
  if (!s) return "";
  return s.replace(/\s+/g, " ").replace(/[^\d+\-\s()]/g, "").trim().slice(0, LENGTH.phone);
}

export function isValidEmail(email) {
  if (!email || email.length > LENGTH.email) return false;
  return EMAIL_RE.test(email);
}

/** Client-side checklist (mirror server messages where possible). */
export function validateDirectorSignupClientFields(fields) {
  const err = {};
  const { fullName, email, phone, directorCode, password, confirmPassword } = fields;
  if (!fullName) err.fullName = "Full name is required.";
  if (!email) err.email = "Email is required.";
  else if (!isValidEmail(email)) err.email = "Enter a valid email address.";
  if (!phone) err.phone = "Phone number is required.";
  else if (phone.replace(/\D/g, "").length < 8) err.phone = "Enter a complete phone number.";
  if (!directorCode) err.directorCode = "Director code is required.";
  if (!password) err.password = "Password is required.";
  else if (password.length < 8) err.password = "Password must be at least 8 characters.";
  if (!confirmPassword) err.confirmPassword = "Please confirm your password.";
  else if (password !== confirmPassword) err.confirmPassword = "Passwords do not match.";
  return err;
}
