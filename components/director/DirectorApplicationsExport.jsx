"use client";

import { useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import {
  DIRECTOR_EXPORT_LABELS,
  DIRECTOR_EXPORT_TYPES,
} from "@/lib/director-application-export-types";

const OPTIONS = DIRECTOR_EXPORT_TYPES.map((type) => ({
  type,
  label: DIRECTOR_EXPORT_LABELS[type],
}));

const SAFE_EXPORT_ERRORS = new Set([
  "Could not load applications.",
  "Could not load university special invitees.",
  "University special invitees are not available yet.",
  "Invalid export type.",
  "Export failed.",
  "Could not prepare this export.",
]);

function safeExportError(message, fallback) {
  return SAFE_EXPORT_ERRORS.has(message) ? message : fallback;
}

export default function DirectorApplicationsExport({ filters = {} }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("called_for_interview");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview(nextType) {
    setLoadingPreview(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/director/applications/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType, filters, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(safeExportError(data.error, "Could not prepare this export."));
        return;
      }
      setPreview(data);
    } catch {
      setError("Could not prepare this export.");
    } finally {
      setLoadingPreview(false);
    }
  }

  function openDialog() {
    setOpen(true);
    setError("");
    loadPreview(type);
  }

  function choose(nextType) {
    if (downloading || nextType === type) return;
    setType(nextType);
    loadPreview(nextType);
  }

  async function download() {
    if (downloading || loadingPreview || !preview || preview.count < 1) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("/api/director/applications/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters, preview: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(safeExportError(data.error, "Export failed."));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = preview.filename || "KSP_Export.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
      >
        <Download size={16} />
        Export to Excel
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Export to Excel</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Downloads a spreadsheet of the selected group. Draft applications are not included.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close export dialog"
              >
                <X size={16} />
              </button>
            </div>
            <fieldset className="mt-4 space-y-2" disabled={downloading}>
              <legend className="sr-only">Export category</legend>
              {OPTIONS.map((option) => (
                <label key={option.type} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="export-type"
                    checked={type === option.type}
                    onChange={() => choose(option.type)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <div className="mt-4 min-h-[3rem] text-sm">
              {loadingPreview ? (
                <p className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Counting records…
                </p>
              ) : error ? (
                <div className="space-y-2">
                  <p className="text-red-700" role="alert">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadPreview(type)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-800"
                  >
                    Retry
                  </button>
                </div>
              ) : preview ? (
                <p className="text-gray-700">
                  <span className="font-semibold">{preview.label}</span>
                  {" — "}
                  {preview.count === 0
                    ? type === "university_special_invitees"
                      ? "No matching invitees"
                      : "No matching applicants"
                    : `${preview.count} record${preview.count === 1 ? "" : "s"} will be downloaded.`}
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={downloading || loadingPreview || !preview || preview.count < 1}
                onClick={download}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? "Preparing file…" : "Download"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
