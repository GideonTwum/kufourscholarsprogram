/**
 * Normalize and validate storage object paths for the applications bucket.
 */

/**
 * @param {string} rawPath
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function sanitizeStoragePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") {
    return { ok: false, error: "Missing path" };
  }

  let path = rawPath.trim();
  if (!path) return { ok: false, error: "Missing path" };

  // Reject absolute / URL / protocol-relative
  if (path.startsWith("/") || path.startsWith("\\")) {
    return { ok: false, error: "Invalid path" };
  }
  if (path.includes("://") || path.startsWith("//")) {
    return { ok: false, error: "Invalid path" };
  }
  if (path.includes("\\")) {
    return { ok: false, error: "Invalid path" };
  }

  // Normalize: collapse duplicate slashes, strip leading ./ 
  path = path.replace(/\/+/g, "/").replace(/^\.\//, "");

  const segments = path.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    return { ok: false, error: "Invalid path" };
  }

  // Must be {userId}/{filename...}
  if (segments.length < 2) {
    return { ok: false, error: "Invalid path" };
  }

  const userId = segments[0];
  // UUID-ish or opaque auth user id (supabase uses UUID)
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(userId)) {
    return { ok: false, error: "Invalid path" };
  }

  return { ok: true, path: segments.join("/") };
}

export function isOwnerStoragePath(path, userId) {
  if (!path || !userId) return false;
  return path === userId || path.startsWith(`${userId}/`);
}
