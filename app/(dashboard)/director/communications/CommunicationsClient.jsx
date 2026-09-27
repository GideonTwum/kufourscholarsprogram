"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  Loader2,
  Send,
  Eye,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_AUDIENCE_HINTS,
  COMMUNICATION_APPLICANT_SEARCH_MIN_CHARS,
  COMMUNICATION_TEMPLATES,
  getCommunicationTemplate,
  buildPersonalizedEmail,
} from "@/lib/director-communications";

const BULK_AUDIENCES = COMMUNICATION_AUDIENCES.filter((a) => a !== "individual");

function statusBadgeClass(status) {
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "partial_failure") return "bg-amber-50 text-amber-800";
  if (status === "failed") return "bg-red-50 text-red-700";
  if (status === "processing" || status === "queued") return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

function formatApplicationStatus(status) {
  if (!status) return "";
  return String(status).replace(/_/g, " ");
}

export default function CommunicationsClient() {
  const searchParams = useSearchParams();
  const applicantId = searchParams.get("applicant") || "";

  const [tab, setTab] = useState("compose");
  const [audience, setAudience] = useState(applicantId ? "individual" : "all_submitted");
  const [applicationId, setApplicationId] = useState(applicantId);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [applicantQuery, setApplicantQuery] = useState("");
  const [applicantResults, setApplicantResults] = useState([]);
  const [applicantSearchLoading, setApplicantSearchLoading] = useState(false);
  const [applicantSearchMessage, setApplicantSearchMessage] = useState(
    "Type a name or email to search."
  );
  const [applicantLookupLoading, setApplicantLookupLoading] = useState(false);
  const [templateId, setTemplateId] = useState("application_update");
  const [subject, setSubject] = useState(COMMUNICATION_TEMPLATES[0].subject);
  const [body, setBody] = useState(COMMUNICATION_TEMPLATES[0].body);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [sendProgress, setSendProgress] = useState(null);
  const [resumingId, setResumingId] = useState("");

  useEffect(() => {
    if (applicantId) {
      setAudience("individual");
      setApplicationId(applicantId);
      setTab("compose");
    }
  }, [applicantId]);

  // Prefill selected applicant from detail-page deep link (application_id in URL only)
  useEffect(() => {
    if (!applicantId) return;
    let cancelled = false;
    async function loadApplicant() {
      setApplicantLookupLoading(true);
      try {
        const res = await fetch(
          `/api/director/communications/applicants?application_id=${encodeURIComponent(applicantId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.applicant) {
          setSelectedApplicant(data.applicant);
          setApplicationId(data.applicant.application_id);
          setApplicantQuery("");
          setApplicantResults([]);
        } else {
          setError(data.error || "Could not load the selected applicant.");
        }
      } catch {
        if (!cancelled) setError("Could not load the selected applicant.");
      } finally {
        if (!cancelled) setApplicantLookupLoading(false);
      }
    }
    loadApplicant();
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  // Debounced applicant search
  useEffect(() => {
    if (audience !== "individual" || selectedApplicant) return;
    const q = applicantQuery.trim();
    if (q.length < COMMUNICATION_APPLICANT_SEARCH_MIN_CHARS) {
      setApplicantResults([]);
      setApplicantSearchMessage(
        q.length === 0
          ? "Type a name or email to search."
          : `Type at least ${COMMUNICATION_APPLICANT_SEARCH_MIN_CHARS} characters to search.`
      );
      setApplicantSearchLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setApplicantSearchLoading(true);
      setApplicantSearchMessage("Searching...");
      try {
        const res = await fetch(
          `/api/director/communications/applicants?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setApplicantResults([]);
          setApplicantSearchMessage(data.error || "Search failed.");
        } else {
          setApplicantResults(data.applicants || []);
          setApplicantSearchMessage(
            data.message ||
              ((data.applicants || []).length === 0
                ? "No submitted applicants found."
                : "")
          );
        }
      } catch {
        setApplicantResults([]);
        setApplicantSearchMessage("Search failed.");
      } finally {
        setApplicantSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [applicantQuery, audience, selectedApplicant]);

  function selectApplicant(applicant) {
    setSelectedApplicant(applicant);
    setApplicationId(applicant.application_id);
    setApplicantQuery("");
    setApplicantResults([]);
    setPreview(null);
  }

  function clearSelectedApplicant() {
    setSelectedApplicant(null);
    setApplicationId("");
    setApplicantQuery("");
    setApplicantResults([]);
    setPreview(null);
    setApplicantSearchMessage("Type a name or email to search.");
  }
  function applyTemplate(id) {
    setTemplateId(id);
    const t = getCommunicationTemplate(id);
    if (!t) return;
    if (t.subject) setSubject(t.subject);
    setBody(t.body);
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError("");
    try {
      const res = await fetch("/api/director/communications");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load history.");
        setHistory([]);
      } else {
        setHistory(data.communications || []);
      }
    } catch {
      setError("Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  async function continueSending(communicationId) {
    let done = false;
    let last = null;
    while (!done) {
      const res = await fetch(`/api/director/communications/${communicationId}/continue`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Continue send failed.");
      }
      last = data;
      setSendProgress(data);
      done = Boolean(data.done);
      if (!done) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    return last;
  }

  async function resumeCampaign(communicationId) {
    setResumingId(communicationId);
    setError("");
    setSuccess("");
    setSendProgress(null);
    try {
      const finalResult = await continueSending(communicationId);
      setSuccess(
        finalResult.message ||
          `Finished: ${finalResult.successful_count ?? 0} delivered, ${finalResult.failed_count ?? 0} failed.`
      );
      loadHistory();
    } catch (e) {
      setError(
        e.message ||
          "Resume interrupted. Refresh History and click Resume Sending again — already-sent applicants will not be emailed twice."
      );
      loadHistory();
    } finally {
      setResumingId("");
      setSendProgress(null);
    }
  }

  async function previewRecipients() {
    setPreviewLoading(true);
    setError("");
    setSuccess("");
    setPreview(null);
    if (audience === "individual" && !applicationId) {
      setError("Select an applicant before previewing.");
      setPreviewLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/director/communications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          application_id: audience === "individual" ? applicationId : undefined,
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Preview failed.");
      } else {
        setPreview(data);
      }
    } catch {
      setError("Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  const sampleEmail = useMemo(() => {
    const name = preview?.preview?.[0]?.full_name || "Ama Mensah";
    return buildPersonalizedEmail({ subject, body, fullName: name });
  }, [subject, body, preview]);

  async function confirmAndSend() {
    setSending(true);
    setError("");
    setSuccess("");
    setSendProgress(null);
    const key = idempotencyKey || `comm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setIdempotencyKey(key);
    try {
      const res = await fetch("/api/director/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          application_id: audience === "individual" ? applicationId : undefined,
          subject,
          body,
          confirm: true,
          idempotency_key: key,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed.");
        setConfirmOpen(false);
        return;
      }

      setSendProgress(data);
      let finalResult = data;
      if (!data.done && data.communication_id) {
        finalResult = await continueSending(data.communication_id);
      }

      setConfirmOpen(false);
      setIdempotencyKey("");
      setSuccess(
        finalResult.message ||
          `Finished: ${finalResult.successful_count ?? 0} delivered, ${finalResult.failed_count ?? 0} failed.`
      );
      setTab("history");
      loadHistory();
    } catch (e) {
      setError(e.message || "Send failed.");
    } finally {
      setSending(false);
    }
  }

  function openConfirm() {
    setError("");
    if (audience === "individual" && !applicationId) {
      setError("Select an applicant before sending.");
      return;
    }
    if (!preview || preview.recipient_count < 1) {
      setError("Preview recipients first and ensure at least one valid email exists.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required.");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Mail className="text-royal" size={28} />
          Communications
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Send updates and recruitment messages to applicants. Recipients are resolved securely on
          the server from your selected audience. Large sends run in small batches — keep this page
          open until finished, or use Resume Sending from History if interrupted.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: "compose", label: "Compose" },
          { key: "templates", label: "Templates" },
          { key: "history", label: "History" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.key ? "bg-royal text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="space-y-3">
          {COMMUNICATION_TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{t.label}</h2>
                <button
                  type="button"
                  onClick={() => {
                    applyTemplate(t.id);
                    setTab("compose");
                  }}
                  className="rounded-lg bg-royal px-3 py-1.5 text-xs font-medium text-white hover:bg-royal/90"
                >
                  Use template
                </button>
              </div>
              {t.subject ? <p className="mt-1 text-xs text-gray-500">Subject: {t.subject}</p> : null}
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                {t.body}
              </pre>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Recent Communications</h2>
            <button
              type="button"
              onClick={loadHistory}
              className="inline-flex items-center gap-1 text-sm text-royal hover:text-gold"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-royal" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No communications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((row) => {
                const canResume = row.status === "processing" || row.status === "queued";
                const remaining = Math.max(
                  0,
                  (row.recipient_count || 0) - (row.successful_count || 0) - (row.failed_count || 0)
                );
                return (
                  <li key={row.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{row.subject}</p>
                        <p className="text-xs text-gray-500">
                          {row.audience_label} · {row.recipient_count} recipients ·{" "}
                          {row.successful_count ?? 0} delivered · {row.failed_count ?? 0} failed
                          {canResume ? ` · ~${remaining} remaining` : ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          {row.created_by_name_snapshot || "Director"} ·{" "}
                          {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
                        </p>
                        {canResume ? (
                          <p className="mt-1 text-xs text-blue-700">
                            Sending was interrupted or is still in progress. Resume continues the
                            original recipient list only — already-delivered applicants are skipped.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                        >
                          {row.status?.replace(/_/g, " ")}
                        </span>
                        {canResume ? (
                          <button
                            type="button"
                            disabled={Boolean(resumingId)}
                            onClick={() => resumeCampaign(row.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-royal px-3 py-1.5 text-xs font-medium text-white hover:bg-royal/90 disabled:opacity-50"
                          >
                            {resumingId === row.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                            Resume Sending
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {resumingId === row.id && sendProgress ? (
                      <p className="mt-2 text-xs text-blue-700">
                        Progress: {sendProgress.successful_count ?? 0} delivered,{" "}
                        {sendProgress.failed_count ?? 0} failed,{" "}
                        {sendProgress.remaining_pending ?? "?"} pending…
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "compose" ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="audience">
                  Audience
                </label>
                <select
                  id="audience"
                  value={audience}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAudience(next);
                    setPreview(null);
                    if (next !== "individual") {
                      setSelectedApplicant(null);
                      setApplicationId("");
                      setApplicantQuery("");
                      setApplicantResults([]);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {(applicantId ? COMMUNICATION_AUDIENCES : BULK_AUDIENCES).map((key) => (
                    <option key={key} value={key}>
                      {COMMUNICATION_AUDIENCE_LABELS[key]}
                    </option>
                  ))}
                  {!applicantId ? (
                    <option value="individual">{COMMUNICATION_AUDIENCE_LABELS.individual}</option>
                  ) : null}
                </select>
                {COMMUNICATION_AUDIENCE_HINTS[audience] ? (
                  <p className="mt-1 text-xs text-amber-800">{COMMUNICATION_AUDIENCE_HINTS[audience]}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="template">
                  Template
                </label>
                <select
                  id="template"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {COMMUNICATION_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {audience === "individual" ? (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="applicant-search">
                  Applicant
                </label>
                {applicantLookupLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                    <Loader2 size={16} className="animate-spin text-royal" />
                    Loading applicant…
                  </div>
                ) : selectedApplicant ? (
                  <div className="rounded-lg border border-royal/20 bg-royal/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {selectedApplicant.full_name}
                        </p>
                        <p className="truncate text-sm text-gray-600">
                          {selectedApplicant.email || "No email on file"}
                          {selectedApplicant.university
                            ? ` · ${selectedApplicant.university}`
                            : ""}
                        </p>
                        {selectedApplicant.status ? (
                          <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-gray-700 ring-1 ring-gray-200">
                            {formatApplicationStatus(selectedApplicant.status)}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedApplicant}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <X size={12} />
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id="applicant-search"
                        type="search"
                        autoComplete="off"
                        value={applicantQuery}
                        onChange={(e) => {
                          setApplicantQuery(e.target.value);
                          setPreview(null);
                        }}
                        className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
                        placeholder="Search applicant by name or email..."
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Search for a submitted applicant by name or email.
                    </p>
                    {(applicantSearchLoading ||
                      applicantQuery.trim().length > 0 ||
                      applicantResults.length > 0) && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {applicantSearchLoading ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                            <Loader2 size={14} className="animate-spin" />
                            Searching...
                          </div>
                        ) : applicantResults.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-gray-500">{applicantSearchMessage}</p>
                        ) : (
                          <ul className="divide-y divide-gray-50 py-1">
                            {applicantResults.map((row) => (
                              <li key={row.application_id}>
                                <button
                                  type="button"
                                  onClick={() => selectApplicant(row)}
                                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-royal/5"
                                >
                                  <span className="font-medium text-gray-900">{row.full_name}</span>
                                  <span className="truncate text-xs text-gray-600">
                                    {row.email || "No email"}
                                    {row.university ? ` · ${row.university}` : ""}
                                  </span>
                                  {row.status ? (
                                    <span className="mt-0.5 text-[11px] capitalize text-gray-500">
                                      {formatApplicationStatus(row.status)}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                maxLength={200}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="body">
                Message
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                maxLength={12000}
              />
              <p className="mt-1 text-xs text-gray-500">
                Personalization: {"{{first_name}}"}, {"{{full_name}}"}. Each applicant receives their
                own private email.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewRecipients}
                disabled={previewLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                Preview Recipients
              </button>
              <button
                type="button"
                onClick={() => setEmailPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Eye size={16} />
                Preview Email
              </button>
              <button
                type="button"
                onClick={openConfirm}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-medium text-white hover:bg-royal/90 disabled:opacity-50"
              >
                <Send size={16} />
                Send Message
              </button>
            </div>
          </div>

          {preview ? (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">Recipient preview</h2>
              <p className="mt-1 text-sm text-gray-700">{preview.message}</p>
              {preview.exclusion_message ? (
                <p className="mt-1 text-sm text-amber-700">{preview.exclusion_message}</p>
              ) : null}
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Institution</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.preview || []).map((r) => (
                      <tr key={r.application_id} className="border-b border-gray-50">
                        <td className="py-2 pr-3">{r.full_name}</td>
                        <td className="py-2 pr-3 text-gray-600">{r.university || "—"}</td>
                        <td className="py-2 pr-3 text-gray-600">{r.status?.replace(/_/g, " ")}</td>
                        <td className="py-2 text-gray-600">{r.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.has_more ? (
                <p className="mt-2 text-xs text-gray-500">
                  Showing first {preview.preview_limit} of {preview.recipient_count}. Full send uses
                  the complete server-resolved list.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {emailPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Email preview</h3>
            <p className="mt-1 text-xs text-gray-500">Sample personalization for one applicant.</p>
            <p className="mt-3 text-sm">
              <span className="font-medium">Subject:</span> {sampleEmail.subject}
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
              {sampleEmail.text}
            </pre>
            <button
              type="button"
              onClick={() => setEmailPreviewOpen(false)}
              className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Send communication</h3>
            <dl className="mt-3 space-y-2 text-sm text-gray-700">
              <div>
                <dt className="text-gray-500">Audience</dt>
                <dd className="font-medium">{COMMUNICATION_AUDIENCE_LABELS[audience]}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Recipients</dt>
                <dd className="font-medium">{preview?.recipient_count ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Subject</dt>
                <dd className="font-medium break-words">{subject}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-gray-600">
              You are about to send this message to {preview?.recipient_count ?? 0} applicant
              {(preview?.recipient_count ?? 0) === 1 ? "" : "s"}. Each person receives a private
              email. Large campaigns send in batches of 15 — keep this dialog open until finished.
              Closing the browser does not cancel already-sent emails; use Resume Sending in History
              for any remaining recipients.
            </p>
            {sendProgress && !sendProgress.done ? (
              <p className="mt-2 text-sm text-blue-700">
                Sending… {sendProgress.successful_count ?? 0} delivered,{" "}
                {sendProgress.remaining_pending ?? "?"} remaining.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={confirmAndSend}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Confirm &amp; Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-8 text-xs text-gray-400">
        In-portal announcements remain under{" "}
        <Link href="/director/announcements" className="text-royal hover:underline">
          Announcements
        </Link>
        . This centre sends email via the existing Resend integration.
      </p>
    </div>
  );
}
