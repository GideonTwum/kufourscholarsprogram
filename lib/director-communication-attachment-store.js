/**
 * Private storage helpers for Director Communication attachments.
 * Uses service-role Admin client only. Objects are never public by default.
 */

import { randomUUID } from "node:crypto";
import {
  DIRECTOR_COMM_ATTACHMENTS_BUCKET,
  DIRECTOR_COMM_ATTACHMENT_SIGNED_URL_SECONDS,
  buildDirectorCommStoragePath,
  buildResendAttachmentsFromSignedUrls,
  validateDirectorCommunicationAttachments,
} from "./director-communication-attachments.js";

function isMissingRelation(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /attachments/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

function isMissingBucket(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("bucket") ||
    message.includes("not found") ||
    message.includes("does not exist")
  );
}

/**
 * Persist validated files for a communication and return metadata descriptors.
 */
export async function storeDirectorCommunicationAttachments(
  admin,
  { directorId, communicationId, files }
) {
  const prepared = [];
  for (const file of files || []) {
    const bytes = Buffer.from(await file.arrayBuffer());
    prepared.push({ file, bytes });
  }

  const validated = validateDirectorCommunicationAttachments(prepared);
  if (!validated.ok) {
    return { ok: false, error: validated.error, code: validated.code || "invalid_attachments" };
  }

  const descriptors = [];
  for (let i = 0; i < prepared.length; i += 1) {
    const meta = validated.attachments[i];
    const id = randomUUID();
    const storagePath = buildDirectorCommStoragePath(
      directorId,
      communicationId,
      id,
      meta.filename
    );
    const { error } = await admin.storage
      .from(DIRECTOR_COMM_ATTACHMENTS_BUCKET)
      .upload(storagePath, prepared[i].bytes, {
        contentType: meta.contentType,
        upsert: false,
      });

    if (error) {
      console.error("[communications-attachments] upload failed", {
        code: error.statusCode || error.name || null,
        message: error.message || String(error),
      });
      const unavailable = isMissingBucket(error);
      return {
        ok: false,
        error: unavailable
          ? "Attachment storage is not available until the director-communications attachments migration is applied."
          : "Could not store one or more attachments.",
        code: unavailable ? "storage_unavailable" : "upload_failed",
      };
    }

    descriptors.push({
      id,
      filename: meta.filename,
      content_type: meta.contentType,
      size: meta.size,
      label: meta.label,
      storage_path: storagePath,
    });
  }

  return { ok: true, attachments: descriptors, totalBytes: validated.totalBytes };
}

export async function persistCommunicationAttachmentMetadata(admin, communicationId, attachments) {
  const { error } = await admin
    .from("director_communications")
    .update({ attachments })
    .eq("id", communicationId);

  if (!error) return { ok: true };

  if (isMissingRelation(error)) {
    return {
      ok: false,
      error:
        "Attachment metadata storage is not available until the director-communications attachments migration is applied.",
      code: "schema_unavailable",
    };
  }

  return { ok: false, error: "Could not save attachment metadata.", code: "metadata_failed" };
}

/**
 * Create Resend remote attachments from private storage signed URLs.
 */
export async function loadResendAttachmentsForCommunication(admin, communicationId) {
  const { data: comm, error } = await admin
    .from("director_communications")
    .select("id, attachments")
    .eq("id", communicationId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return { ok: true, attachments: [], descriptors: [] };
    }
    return { ok: false, error: "Could not load attachment metadata." };
  }

  const descriptors = Array.isArray(comm?.attachments) ? comm.attachments : [];
  if (!descriptors.length) {
    return { ok: true, attachments: [], descriptors: [] };
  }

  const withUrls = [];
  for (const row of descriptors) {
    if (!row?.storage_path || !row?.filename) continue;
    const { data, error: signError } = await admin.storage
      .from(DIRECTOR_COMM_ATTACHMENTS_BUCKET)
      .createSignedUrl(row.storage_path, DIRECTOR_COMM_ATTACHMENT_SIGNED_URL_SECONDS);
    if (signError || !data?.signedUrl) {
      return {
        ok: false,
        error: "Could not prepare secure attachment links for sending.",
        code: "signed_url_failed",
      };
    }
    withUrls.push({
      ...row,
      signed_url: data.signedUrl,
    });
  }

  return {
    ok: true,
    descriptors: withUrls,
    attachments: buildResendAttachmentsFromSignedUrls(withUrls),
  };
}

/**
 * Parse multipart File objects from a Next.js request FormData.
 */
export function collectAttachmentFilesFromFormData(formData) {
  if (!formData || typeof formData.getAll !== "function") return [];
  const files = [
    ...formData.getAll("attachments"),
    ...formData.getAll("attachment"),
    ...formData.getAll("files"),
  ];
  return files.filter((entry) => entry && typeof entry === "object" && typeof entry.arrayBuffer === "function");
}
