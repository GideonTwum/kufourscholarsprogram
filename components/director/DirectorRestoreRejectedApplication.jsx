"use client";

import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";

/**
 * Director-only restore of a rejected application to pending review.
 * Does not send notifications or create interview assignments.
 */
export default function DirectorRestoreRejectedApplication({ application, onRestored }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!application || application.status !== "rejected") return null;

  function openDialog() {
    setReason("");
    setError("");
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
  }

  async function confirmRestore(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/director/applications/${application.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not restore this application.");
        return;
      }
      setOpen(false);
      onRestored?.(data);
    } catch {
      setError("Could not restore this application.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
      >
        <RotateCcw size={14} />
        Restore to Pending Review
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="restore-rejected-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="restore-rejected-title" className="text-lg font-bold text-gray-900">
                  Restore to Pending Review
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  This returns the application to the appropriate pending-review status. It does not
                  guarantee progression to the interview stage, does not create interview assignments,
                  and does not send any message to the applicant.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="mb-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500">Applicant</dt>
                <dd className="font-semibold text-gray-900">{application.full_name || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Application ID</dt>
                <dd className="break-all font-mono text-xs text-gray-800">{application.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Current status</dt>
                <dd className="font-semibold text-red-700">Rejected</dd>
              </div>
            </dl>

            <form onSubmit={confirmRestore} className="space-y-4">
              <label className="block text-xs font-medium text-gray-600">
                Administrative reason (optional)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Why is this application being restored?"
                />
              </label>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  {saving ? "Restoring…" : "Confirm restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
