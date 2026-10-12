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

function missingRateLimitFunction(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code === "PGRST202" ||
    /consume_director_signup_attempt/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find the function/i.test(message)
  );
}

export async function consumeSharedRateLimit(key, opts = {}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const max = opts.max ?? 5;
  const started = Date.now();
  try {
    const { createAdminClient } = await import("./supabase/admin.js");
    const { withTimeout } = await import("./applicant-email-change.js");
    const admin = createAdminClient();
    const raced = await withTimeout(
      admin.rpc("consume_director_signup_attempt", {
        p_attempt_key: persistentRateLimitKey(key),
        max_attempts: max,
        window_seconds: Math.round(windowMs / 1000),
      }),
      8000
    );
    if (raced.timedOut) {
      console.error("[rate-limit]", { event: "database_timeout", elapsedMs: Date.now() - started });
      return { allowed: false, unavailable: true, retryAfterSec: 0, source: "database" };
    }
    const { data, error } = raced.value || {};
    if (!error && typeof data === "boolean") {
      console.info("[rate-limit]", {
        event: "database_completed",
        allowed: data,
        elapsedMs: Date.now() - started,
      });
      return {
        allowed: data,
        retryAfterSec: data ? 0 : Math.round(windowMs / 1000),
        source: "database",
      };
    }
    if (error && missingRateLimitFunction(error)) {
      console.info("[rate-limit]", { event: "fallback_memory", code: error.code || "missing_function" });
    } else if (error) {
      console.error("[rate-limit]", {
        event: "database_error",
        code: error.code || null,
        elapsedMs: Date.now() - started,
      });
      return { allowed: false, unavailable: true, retryAfterSec: 0, source: "database" };
    }
  } catch (err) {
    console.error("[rate-limit]", {
      event: "database_exception",
      code: err?.code || null,
    });
    return { allowed: false, unavailable: true, retryAfterSec: 0, source: "database" };
  }
  const local = consumeRateLimit(key, { windowMs, max });
  return { ...local, source: "memory" };
}
