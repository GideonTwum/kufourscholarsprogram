"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

function StatusBadge({ value }) {
  if (value === "configured" || value === "production_verified_domain") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 size={12} /> {String(value).replace(/_/g, " ")}
      </span>
    );
  }
  if (value === "missing" || value === "invalid" || value === "sandbox") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle size={12} /> {value}
      </span>
    );
  }
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
        match
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        mismatch
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <HelpCircle size={12} /> {value == null ? "unknown" : String(value).replace(/_/g, " ")}
    </span>
  );
}

export default function AuthEmailHealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/director/auth-email-health");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || json.code || "Failed to load health check");
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-royal">Auth & email configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Status-only health check. Secret values are never shown. Some Supabase Dashboard settings
          must be verified manually.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-royal" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
          {error.includes("MFA") || error.includes("MFA_REQUIRED") ? (
            <p className="mt-2">Complete Director MFA, then reload this page.</p>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Supabase URL", data.supabase_url],
                  ["Supabase anon key", data.supabase_anon_key],
                  ["Service role (server)", data.service_role],
                  ["Resend API key", data.resend_api_key],
                  ["EMAIL_FROM", data.email_from],
                  ["EMAIL_FROM domain class", data.email_from_domain],
                  ["Sandbox sender in use", data.sandbox_sender_in_use],
                  ["NEXT_PUBLIC_SITE_URL", data.site_url],
                  ["Site URL matches request host", data.site_url_matches_request_host],
                  ["Director MFA required", data.mfa_required_for_director ? "configured" : "missing"],
                  ["Applicant verification", data.applicant_verification],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-4 py-3 font-medium text-gray-700">{label}</td>
                    <td className="px-4 py-3">
                      {typeof value === "string" &&
                      (value === "configured" ||
                        value === "missing" ||
                        value === "invalid" ||
                        value === "production_verified_domain" ||
                        value === "sandbox" ||
                        value === "other_domain" ||
                        value === "unknown") ? (
                        <StatusBadge value={value} />
                      ) : typeof value === "boolean" || value === null ? (
                        <StatusBadge value={value} />
                      ) : (
                        <span className="text-gray-600">{String(value)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Safe callback URLs (non-secret)</p>
            <p className="mt-2 break-all font-mono text-xs">{data.auth_callback_url}</p>
            <p className="mt-1 break-all font-mono text-xs">{data.password_reset_callback_url}</p>
            {data.email_from_using_dev_fallback || data.sandbox_sender_in_use ? (
              <p className="mt-3 text-amber-800">
                Sandbox Resend sender is in use (or EMAIL_FROM is unset in development). Production
                must set EMAIL_FROM to a verified domain and must not use onboarding@resend.dev.
              </p>
            ) : null}
            {data.email_from === "invalid" ? (
              <p className="mt-3 text-red-700">
                EMAIL_FROM is invalid or not allowed in this environment (EMAIL_FROM_INVALID).
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <p className="font-medium text-gray-800">Manual Supabase / Resend checks</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
              {Object.values(data.manual_checks || {}).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
