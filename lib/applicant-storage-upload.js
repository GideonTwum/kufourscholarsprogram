/**
 * Applicant Stage 1 uploads to the private `applications` storage bucket.
 * Paths must be `{auth.uid()}/{folder}/...` to satisfy storage RLS.
 *
 * Uploads use unique object names with upsert disabled so only INSERT
 * (+ SELECT for Storage metadata) is required. Enabling upsert needs a
 * matching UPDATE policy; missing UPDATE historically caused production
 * RLS failures when only INSERT/SELECT policies existed.
 */

export const APPLICATIONS_BUCKET = "applications";

export const APPLICANT_UPLOAD_USER_MESSAGE =
  "We couldn't upload this document. Please try again.";

export const APPLICANT_UPLOAD_SESSION_MESSAGE =
  "Your session may have expired. Please sign in again and retry. Your saved application will not be deleted.";

export const APPLICANT_UPLOAD_TOO_LARGE_MESSAGE =
  "This file is larger than the allowed upload size.";

export const APPLICANT_UPLOAD_UNSUPPORTED_MESSAGE =
  "Please upload a PDF, JPG or PNG file.";

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

export function fileExtensionFromName(fileName) {
  const name = String(fileName || "");
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

/**
 * Prefer browser MIME when present; fall back by extension for mobile PDFs
 * where `file.type` is often blank.
 */
export function resolveApplicantContentType(file, ext) {
  const browserType = typeof file?.type === "string" ? file.type.trim().toLowerCase() : "";
  if (browserType && browserType !== "application/octet-stream") {
    return browserType;
  }
  const e = String(ext || "")
    .replace(/^\./, "")
    .toLowerCase();
  const byExt = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return byExt[e] || undefined;
}

export function isLikelySessionError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("jwt") ||
    m.includes("not authorized") ||
    m.includes("unauthorized") ||
    m.includes("401") ||
    m.includes("auth session missing") ||
    m.includes("session missing") ||
    m.includes("invalid claim") ||
    m.includes("refresh_token")
  );
}

/** @deprecated Use isLikelySessionError / isLikelyRlsError — kept for existing tests */
export function isLikelyStorageAuthError(message) {
  const m = String(message || "").toLowerCase();
  return (
    isLikelySessionError(m) ||
    m.includes("row-level security") ||
    (m.includes("violates") && m.includes("policy")) ||
    m.includes("permission") ||
    m.includes("403")
  );
}

export function isLikelyRlsError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("row-level security") ||
    (m.includes("violates") && m.includes("policy")) ||
    m.includes("403")
  );
}

export function isLikelyPayloadTooLargeError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("payload too large") ||
    m.includes("entity too large") ||
    m.includes("maximum allowed size") ||
    m.includes("file size") ||
    m.includes("413")
  );
}

export function isLikelyMimeTypeError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("mime") ||
    m.includes("content type") ||
    m.includes("content-type") ||
    m.includes("not supported") ||
    m.includes("415")
  );
}

/**
 * Safe operator diagnostics — never log file contents, tokens, or full paths.
 */
export function logApplicantUploadDiagnostic(logLabel, details = {}) {
  const safe = {
    stage: details.stage || "unknown",
    folder: details.folder || undefined,
    ext: details.ext || undefined,
    mime: details.mime || undefined,
    size: typeof details.size === "number" ? details.size : undefined,
    statusCode: details.statusCode || undefined,
    errorCode: details.errorCode || undefined,
    message: details.message ? String(details.message).slice(0, 200) : undefined,
  };
  console.error(logLabel, safe);
}

/**
 * Applicant-facing upload error. Logs sanitized diagnostics for operators.
 * Never surfaces RLS/DB internals or speculative device-capacity claims.
 */
export function toApplicantUploadErrorMessage(error, logLabel = "[applicant-upload]", meta = {}) {
  const raw =
    (error && typeof error === "object" && error.message) ||
    (typeof error === "string" ? error : "") ||
    "Upload failed.";
  const statusCode =
    (error && typeof error === "object" && (error.statusCode || error.status)) || undefined;
  const errorCode = (error && typeof error === "object" && error.error) || undefined;

  logApplicantUploadDiagnostic(logLabel, {
    ...meta,
    stage: meta.stage || "storage_upload",
    message: raw,
    statusCode,
    errorCode,
  });

  if (isLikelyPayloadTooLargeError(raw) || String(statusCode) === "413") {
    return APPLICANT_UPLOAD_TOO_LARGE_MESSAGE;
  }
  if (isLikelyMimeTypeError(raw) || String(statusCode) === "415") {
    return APPLICANT_UPLOAD_UNSUPPORTED_MESSAGE;
  }
  if (isLikelySessionError(raw) || String(statusCode) === "401") {
    return APPLICANT_UPLOAD_SESSION_MESSAGE;
  }
  // RLS/403 and other storage failures: keep a generic recovery message.
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

/**
 * Direct browser → Supabase Storage upload (File/Blob, no Base64).
 * Upsert is disabled because paths from buildApplicantStoragePath are unique.
 */
export async function uploadApplicantDocument(supabase, { path, file, contentType, logMeta }) {
  const options = {
    upsert: false,
    cacheControl: "3600",
  };
  if (contentType) {
    options.contentType = contentType;
  }
  const { data, error } = await supabase.storage.from(APPLICATIONS_BUCKET).upload(path, file, options);
  if (error) {
    logApplicantUploadDiagnostic("[applicant-upload]", {
      ...(logMeta || {}),
      stage: "storage_response",
      message: error.message,
      statusCode: error.statusCode || error.status,
      errorCode: error.error || error.name,
    });
  }
  return { data, error };
}
