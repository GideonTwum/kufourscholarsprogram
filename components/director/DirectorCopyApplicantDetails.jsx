"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DIRECTOR_COPY_CONTACT_FIELDS,
  DIRECTOR_COPY_FIELD_KEYS,
  DIRECTOR_COPY_FIELD_META,
  buildDirectorCopyValues,
  defaultDirectorCopySelection,
  describeDirectorCopyAvailability,
  formatDirectorCopyText,
  normalizeDirectorCopySelection,
} from "@/lib/director-applicant-copy";

async function loadInterviewBatch(application) {
  if (!application?.id) return "";
  const supabase = createClient();
  let allocation = null;
  const { data: allocationRow } = await supabase
    .from("application_interview_allocations")
    .select("application_id, interview_slot_id")
    .eq("application_id", application.id)
    .maybeSingle();
  allocation = allocationRow || null;

  const slotId = allocation?.interview_slot_id || application.interview_slot_id || null;
  let slotsById = {};
  if (slotId) {
    const { data: slot } = await supabase
      .from("interview_slots")
      .select("id, batch_name, interview_date, interview_time, end_time, status, published_at, invitation_sent_at")
      .eq("id", slotId)
      .maybeSingle();
    if (slot) slotsById = { [slot.id]: slot };
  }

  return buildDirectorCopyValues({ application, allocation, slotsById }).interview_batch;
}

export default function DirectorCopyApplicantDetails({ application, email = "" }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() => defaultDirectorCopySelection());
  const [interviewBatch, setInterviewBatch] = useState("");
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const values = useMemo(
    () =>
      buildDirectorCopyValues({
        application,
        email,
        interviewBatch,
      }),
    [application, email, interviewBatch]
  );
  const available = useMemo(() => describeDirectorCopyAvailability(values), [values]);
  const preview = useMemo(() => formatDirectorCopyText(values, selected), [values, selected]);

  useEffect(() => {
    if (!open || !application?.id) return;
    let cancelled = false;
    setLoadingBatch(true);
    loadInterviewBatch(application)
      .then((batch) => {
        if (!cancelled) setInterviewBatch(batch || "");
      })
      .catch(() => {
        if (!cancelled) setInterviewBatch("");
      })
      .finally(() => {
        if (!cancelled) setLoadingBatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, application]);

  function openDialog() {
    setSelected(defaultDirectorCopySelection());
    setMessage("");
    setError("");
    setInterviewBatch("");
    setOpen(true);
  }

  function toggle(key) {
    setMessage("");
    setError("");
    setSelected((current) => {
      const next = new Set(normalizeDirectorCopySelection(current));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return normalizeDirectorCopySelection([...next]);
    });
  }

  async function copyToClipboard() {
    if (copying || selected.length < 1) return;
    setCopying(true);
    setMessage("");
    setError("");
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(preview);
      setMessage("Copied to clipboard.");
    } catch {
      setError("Could not copy. Select the preview text and copy it manually.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-lg border border-royal/20 bg-white px-3 py-1.5 text-xs font-medium text-royal hover:bg-royal/5"
      >
        <Copy size={14} />
        Copy Details
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="copy-applicant-details-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="copy-applicant-details-title" className="text-lg font-bold text-gray-900">
                  Copy Details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Choose fields to copy as plain text for WhatsApp, email, or internal messages.
                  Contact details stay optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="sr-only">Fields to include</legend>
              {DIRECTOR_COPY_FIELD_KEYS.map((key) => {
                const meta = DIRECTOR_COPY_FIELD_META[key];
                const isContact = DIRECTOR_COPY_CONTACT_FIELDS.includes(key);
                return (
                  <label key={key} className="flex items-start gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(key)}
                      onChange={() => toggle(key)}
                    />
                    <span>
                      <span className="font-medium">{meta.label}</span>
                      {isContact ? (
                        <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
                      ) : null}
                      {!available[key] ? (
                        <span className="ml-1 text-xs font-normal text-amber-700">not available</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</p>
                {loadingBatch ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin" /> Loading batch…
                  </span>
                ) : null}
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                {preview}
              </pre>
            </div>

            {message ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-700" role="status">
                <Check size={14} />
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={copying || selected.length < 1}
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                {copying ? "Copying…" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
