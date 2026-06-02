"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function DirectorEmailTestPage() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/director/email-test");
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "error", text: data.error || "Could not load configuration." });
        setConfig(null);
      } else {
        setConfig(data.configuration || null);
      }
    } catch {
      setResult({ type: "error", text: "Network error loading configuration." });
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSendTest() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/director/email-test", { method: "POST" });
      const data = await res.json();
      if (data.configuration) setConfig(data.configuration);

      if (data.success && data.sent) {
        setResult({
          type: "success",
          text: `Test email sent via ${data.via || "email"}. Check your inbox (and spam).`,
        });
      } else {
        const hint =
          data.reason === "no_api_key_or_to"
            ? " RESEND_API_KEY may be empty, or the dev server needs a restart after editing .env.local."
            : "";
        setResult({
          type: "error",
          text:
            (data.reason || data.error || "Email was not sent. Check RESEND_API_KEY and EMAIL_FROM in .env.local.") +
            hint,
        });
      }
    } catch {
      setResult({ type: "error", text: "Network error sending test email." });
    } finally {
      setSending(false);
    }
  }

  if (loadingConfig) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Email test</h1>
        <p className="mt-1 text-sm text-gray-500">
          Verify Resend and sender settings. Sends one test message to your director account email.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900">Configuration</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <ConfigRow label="RESEND_API_KEY" ok={config?.hasResendApiKey} />
          <ConfigRow label="EMAIL_FROM (verified domain)" ok={config?.hasEmailFrom} />
          <ConfigRow label="NEXT_PUBLIC_SITE_URL" ok={config?.hasSiteUrl} />
          <ConfigRow label="SUPABASE_SERVICE_ROLE_KEY" ok={config?.hasServiceRoleKey} />
        </ul>
        {config?.usingDevFallbackFrom && (
          <p className="mt-3 text-xs text-amber-700">
            EMAIL_FROM is not set — using Resend sandbox sender (dev only; limited recipients).
          </p>
        )}
        {config?.missing?.length > 0 && (
          <p className="mt-3 text-xs text-red-600">
            Missing: {config.missing.join(", ")}. Add them in <code className="rounded bg-gray-100 px-1">.env.local</code>{" "}
            (see <code className="rounded bg-gray-100 px-1">.env.example</code>), then{" "}
            <strong>stop and restart</strong> <code className="rounded bg-gray-100 px-1">npm run dev</code> — Next.js
            does not reload env vars while running.
          </p>
        )}
        {config?.isProductionReady && (
          <p className="mt-3 flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 size={14} />
            Production-ready sender configuration detected.
          </p>
        )}

        <button
          type="button"
          onClick={handleSendTest}
          disabled={sending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-royal/90 disabled:opacity-60"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Mail size={18} />
          )}
          {sending ? "Sending…" : "Send test email to me"}
        </button>

        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
              result.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <span>{result.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({ label, ok }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-gray-600">{label}</span>
      <span className={ok ? "font-medium text-green-700" : "font-medium text-red-600"}>
        {ok ? "Set" : "Missing"}
      </span>
    </li>
  );
}
