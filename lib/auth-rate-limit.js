/**
 * Best-effort in-process rate limiting.
 *
 * On serverless (Vercel), each isolate has its own memory — this is NOT a
 * hard global limit. Prefer Supabase Auth rate limits as the authoritative
 * provider control. Documented for abuse reduction only.
 */

const buckets = new Map();

/**
 * @param {string} key
 * @param {{ windowMs?: number, max?: number }} [opts]
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
export function consumeRateLimit(key, opts = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 3;
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0 };
    buckets.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper — clear buckets between unit tests. */
export function __resetRateLimitBucketsForTests() {
  buckets.clear();
}
