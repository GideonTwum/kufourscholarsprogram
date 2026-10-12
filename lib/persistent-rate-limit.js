/**
 * Shared rate limit for serverless isolates.
 * Uses the existing service-role function consume_director_signup_attempt
 * (64-char key, persistent table). Falls back to the in-process bucket only
 * when that function is unavailable.
 */

import { createHash } from "node:crypto";
import { consumeRateLimit } from "./auth-rate-limit.js";

export function persistentRateLimitKey(key) {
  return createHash("sha256").update(String(key)).digest("hex");
}

export async function consumeSharedRateLimit(key, opts = {}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const max = opts.max ?? 5;
  try {
    const { createAdminClient } = await import("./supabase/admin.js");
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_director_signup_attempt", {
      p_attempt_key: persistentRateLimitKey(key),
      max_attempts: max,
      window_seconds: Math.round(windowMs / 1000),
    });
    if (!error && typeof data === "boolean") {
      return {
        allowed: data,
        retryAfterSec: data ? 0 : Math.round(windowMs / 1000),
        source: "database",
      };
    }
  } catch {
    /* database limiter unavailable */
  }
  const local = consumeRateLimit(key, { windowMs, max });
  return { ...local, source: "memory" };
}
