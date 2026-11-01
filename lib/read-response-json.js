/**
 * Parse fetch() bodies without assuming JSON.
 * Empty or non-JSON responses (typical of unhandled 500s) become structured errors.
 */

export function jsonErrorMessage(status, text, contentType) {
  if (!text) {
    return status
      ? `Request failed (${status}) with an empty response.`
      : "Empty response from server.";
  }
  if (contentType && contentType.includes("application/json")) {
    return `Server returned invalid JSON (${status || "unknown"}).`;
  }
  return `Server returned a non-JSON response (${status || "unknown"}).`;
}

export async function readResponseJson(res) {
  const status = Number(res?.status) || 0;
  const contentType = typeof res?.headers?.get === "function" ? res.headers.get("content-type") || "" : "";
  let text = "";
  try {
    text = await res.text();
  } catch {
    return {
      ok: false,
      status,
      data: { error: jsonErrorMessage(status, "", contentType), code: "EMPTY_RESPONSE" },
    };
  }

  if (!String(text).trim()) {
    return {
      ok: false,
      status,
      data: {
        error: jsonErrorMessage(status, "", contentType),
        code: "EMPTY_RESPONSE",
      },
    };
  }

  try {
    const data = JSON.parse(text);
    const payload = data && typeof data === "object" ? data : { value: data };
    return { ok: Boolean(res?.ok), status, data: payload };
  } catch {
    return {
      ok: false,
      status,
      data: {
        error: jsonErrorMessage(status, text, contentType),
        code: "INVALID_JSON",
      },
    };
  }
}

export async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    return readResponseJson(res);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        error: error?.message || "Network error",
        code: "NETWORK_ERROR",
      },
    };
  }
}
