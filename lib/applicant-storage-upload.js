/**
 * Applicant Stage 1 uploads to the private `applications` storage bucket.
 * Paths must be `{auth.uid()}/{folder}/...` to satisfy storage RLS.
 */

export const APPLICATIONS_BUCKET = "applications";

export const APPLICANT_UPLOAD_USER_MESSAGE =
  "We couldn't upload your document. Please try again. If the problem continues, contact KSP support.";

/** Build a unique object path under the authenticated user's namespace. */
export function buildApplicantStoragePath(userId, folder, ext) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const folderClean = String(folder || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
  const extension = String(ext || "")
    .replace(/^\./, "")
    .toLowerCase();
  if (!uid || !folderClean || !extension) {
    throw new Error("Invalid storage path inputs");
  }
  if (folderClean.includes("..") || uid.includes("/")) {
    throw new Error("Invalid storage path inputs");
  }
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${uid}/${folderClean}/${stamp}.${extension}`;
}

export function isLikelyStorageAuthError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("row-level security") ||
    (m.includes("violates") && m.includes("policy")) ||
    m.includes("jwt") ||
    m.includes("not authorized") ||
    m.includes("unauthorized") ||
    m.includes("permission") ||
    m.includes("403")
  );
}

/**
 * Applicant-facing upload error. Logs the raw error for operators/dev.
 * Never surfaces RLS/DB internals in the UI.
 */
export function toApplicantUploadErrorMessage(error, logLabel = "[applicant-upload]") {
  const raw =
    (error && typeof error === "object" && error.message) ||
    (typeof error === "string" ? error : "") ||
    "Upload failed.";
  console.error(logLabel, raw, error);
  return APPLICANT_UPLOAD_USER_MESSAGE;
}

/**
 * Resolve the signed-in user for storage uploads.
 * Returns null if there is no authenticated session.
 */
export async function resolveAuthenticatedUploadUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user;
}
