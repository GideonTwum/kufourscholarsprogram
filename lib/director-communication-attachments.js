/**
 * Director Communications attachment validation and Resend payload helpers.
 * Does not make files public. Does not invent provider limits.
 *
 * Resend documented limits (verified):
 * - Total email size including Base64-encoded attachments: 40MB
 * - Attachments are not supported on Resend's batch endpoint
 * - Executable/script extensions are blocked by Resend
 *
 * KSP uses individual sends already. Conservative app limits keep bulk campaigns safe.
 */

export const DIRECTOR_COMM_ATTACHMENTS_BUCKET = "director-communications";

/** Conservative per-file limit (raw bytes). */
export const DIRECTOR_COMM_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

/** Conservative total raw attachment budget per email. */
export const DIRECTOR_COMM_ATTACHMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export const DIRECTOR_COMM_ATTACHMENT_MAX_COUNT = 5;

/** Signed URL lifetime for Resend remote fetches during multi-batch sends. */
export const DIRECTOR_COMM_ATTACHMENT_SIGNED_URL_SECONDS = 6 * 60 * 60;

export const DIRECTOR_COMM_ATTACHMENT_ALLOWED = Object.freeze({
  pdf: { mime: "application/pdf", label: "PDF" },
  doc: { mime: "application/msword", label: "Word" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
  },
  xls: { mime: "application/vnd.ms-excel", label: "Excel" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
  },
  ppt: { mime: "application/vnd.ms-powerpoint", label: "PowerPoint" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
  },
  jpg: { mime: "image/jpeg", label: "Image" },
  jpeg: { mime: "image/jpeg", label: "Image" },
  png: { mime: "image/png", label: "Image" },
  webp: { mime: "image/webp", label: "Image" },
  txt: { mime: "text/plain", label: "Text" },
});

export const DIRECTOR_COMM_VIDEO_EXTENSIONS = Object.freeze(["mp4", "mov", "webm"]);

const DANGEROUS_EXTENSIONS = Object.freeze([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "jse",
  "vbs",
  "vbe",
  "wsf",
  "wsh",
  "ps1",
  "reg",
  "jar",
  "dll",
  "sh",
  "bash",
  "php",
  "asp",
  "aspx",
  "html",
  "htm",
  "svg",
]);

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  return null;
}

export function fileExtensionFromName(fileName) {
  const name = String(fileName || "");
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

/**
 * Strip path segments and control characters. Keeps a readable basename.
 */
export function sanitizeAttachmentFilename(fileName) {
  const base = String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  const cleaned = String(base || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const limited = cleaned.slice(0, 120);
  if (!limited || limited === "." || limited === "..") return "attachment";
  return limited;
}

export function formatAttachmentBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isDirectorCommVideoExtension(ext) {
  return DIRECTOR_COMM_VIDEO_EXTENSIONS.includes(String(ext || "").toLowerCase());
}

/**
 * Sniff common signatures. Returns false when content clearly mismatches.
 * Unknown/soft types (txt, some Office) return true when not obviously hostile.
 */
export function attachmentContentLooksValid(ext, bytes) {
  const buf = asBuffer(bytes);
  if (!buf || buf.length < 4) return false;
  const e = String(ext || "").toLowerCase();

  if (e === "pdf") return buf.slice(0, 5).toString("utf8") === "%PDF-";
  if (e === "png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (e === "jpg" || e === "jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (e === "webp") {
    return (
      buf.slice(0, 4).toString("utf8") === "RIFF" && buf.slice(8, 12).toString("utf8") === "WEBP"
    );
  }
  if (e === "docx" || e === "xlsx" || e === "pptx") {
    return buf[0] === 0x50 && buf[1] === 0x4b;
  }
  if (e === "doc" || e === "xls" || e === "ppt") {
    return buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  }
  if (e === "txt") {
    // Reject obvious binary / null-heavy payloads.
    const sample = buf.subarray(0, Math.min(buf.length, 512));
    let nulls = 0;
    for (const b of sample) if (b === 0) nulls += 1;
    return nulls === 0;
  }
  return true;
}

/**
 * Validate one candidate attachment before upload/send.
 * @returns {{ ok: true, filename: string, ext: string, contentType: string, size: number } | { ok: false, error: string, code?: string }}
 */
export function validateDirectorCommunicationAttachment(fileLike, bytes) {
  const originalName = fileLike?.name || fileLike?.filename || "attachment";
  const filename = sanitizeAttachmentFilename(originalName);
  const ext = fileExtensionFromName(filename);
  const size = asBuffer(bytes)?.length ?? Number(fileLike?.size) ?? 0;

  if (!ext) {
    return { ok: false, error: "Each attachment must include a file extension.", code: "missing_extension" };
  }
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `"${filename}" is a blocked file type.`, code: "dangerous_type" };
  }
  if (isDirectorCommVideoExtension(ext)) {
    return {
      ok: false,
      error:
        "Video files are too large for reliable email attachments. Upload the video privately and share a secure link in the message instead.",
      code: "video_not_attached",
    };
  }
  if (!DIRECTOR_COMM_ATTACHMENT_ALLOWED[ext]) {
    return {
      ok: false,
      error: `"${filename}" is not a supported attachment type.`,
      code: "unsupported_type",
    };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: `"${filename}" is empty.`, code: "empty_file" };
  }
  if (size > DIRECTOR_COMM_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      error: `"${filename}" is larger than ${formatAttachmentBytes(DIRECTOR_COMM_ATTACHMENT_MAX_BYTES)}.`,
      code: "file_too_large",
    };
  }

  const allowed = DIRECTOR_COMM_ATTACHMENT_ALLOWED[ext];
  const declared =
    typeof fileLike?.type === "string" && fileLike.type && fileLike.type !== "application/octet-stream"
      ? fileLike.type.toLowerCase()
      : allowed.mime;

  if (bytes && !attachmentContentLooksValid(ext, bytes)) {
    return {
      ok: false,
      error: `"${filename}" content does not match its file type.`,
      code: "content_mismatch",
    };
  }

  return {
    ok: true,
    filename,
    ext,
    contentType: declared || allowed.mime,
    size,
    label: allowed.label,
  };
}

/**
 * Validate a set of attachments for one email.
 */
export function validateDirectorCommunicationAttachments(items = []) {
  if (!Array.isArray(items)) {
    return { ok: false, error: "Attachments must be a list.", code: "invalid_attachments" };
  }
  if (items.length > DIRECTOR_COMM_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      error: `You can attach at most ${DIRECTOR_COMM_ATTACHMENT_MAX_COUNT} files.`,
      code: "too_many_files",
    };
  }

  const accepted = [];
  let total = 0;
  for (const item of items) {
    const checked = validateDirectorCommunicationAttachment(item.file || item, item.bytes || item.content);
    if (!checked.ok) return checked;
    total += checked.size;
    if (total > DIRECTOR_COMM_ATTACHMENT_MAX_TOTAL_BYTES) {
      return {
        ok: false,
        error: `Total attachments must be at most ${formatAttachmentBytes(DIRECTOR_COMM_ATTACHMENT_MAX_TOTAL_BYTES)}.`,
        code: "total_too_large",
      };
    }
    accepted.push(checked);
  }
  return { ok: true, attachments: accepted, totalBytes: total };
}

export function buildDirectorCommStoragePath(directorId, communicationId, attachmentId, filename) {
  const safeDirector = String(directorId || "").trim();
  const safeComm = String(communicationId || "").trim();
  const safeId = String(attachmentId || "").trim();
  const safeName = sanitizeAttachmentFilename(filename);
  if (!safeDirector || !safeComm || !safeId) {
    throw new Error("Invalid attachment storage path inputs");
  }
  if (safeDirector.includes("/") || safeComm.includes("/") || safeId.includes("/")) {
    throw new Error("Invalid attachment storage path inputs");
  }
  return `${safeDirector}/${safeComm}/${safeId}-${safeName}`;
}

/**
 * Build Resend attachment objects using remote signed URLs (preferred for bulk).
 * Avoids re-uploading file bytes from the app for every recipient.
 */
export function buildResendAttachmentsFromSignedUrls(descriptors = []) {
  return (descriptors || [])
    .filter((row) => row?.signed_url && row?.filename)
    .map((row) => ({
      path: row.signed_url,
      filename: sanitizeAttachmentFilename(row.filename),
      content_type: row.content_type || undefined,
    }));
}

/**
 * Build Resend attachment objects from in-memory content (single/small sends / tests).
 */
export function buildResendAttachmentsFromContent(items = []) {
  return (items || []).map((item) => {
    const buf = asBuffer(item.bytes || item.content);
    return {
      filename: sanitizeAttachmentFilename(item.filename || item.name || "attachment"),
      content: buf ? buf.toString("base64") : "",
      content_type: item.content_type || undefined,
    };
  });
}

export function summarizeAttachmentDescriptors(descriptors = []) {
  const list = Array.isArray(descriptors) ? descriptors : [];
  return {
    count: list.length,
    total_bytes: list.reduce((sum, row) => sum + (Number(row.size) || 0), 0),
    filenames: list.map((row) => row.filename).filter(Boolean),
  };
}

export function attachmentDescriptorsForClient(descriptors = []) {
  return (descriptors || []).map((row) => ({
    id: row.id,
    filename: row.filename,
    content_type: row.content_type,
    size: row.size,
    label: row.label || null,
  }));
}
