"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import InstitutionSelect from "@/components/applicant/InstitutionSelect";
import { GENDER_OPTIONS, formatGenderLabel } from "@/lib/applicant-demographics";
import { buildApplicantDetailsCorrection } from "@/lib/director-applicant-details";

const LABELS = {
  full_name: "Full Name",
  university: "School / University",
  hometown: "Hometown",
  program: "Course / Programme",
  gender: "Gender",
};

function displayValue(field, value) {
  if (field === "gender") return formatGenderLabel(value) || "—";
  return value || "—";
}

/**
 * Director-only correction of name, university, hometown, programme, and gender.
 * @param {{
 *   application: { id: string, full_name?: string, university?: string, hometown?: string, program?: string, gender?: string },
 *   onSaved: (fields: Record<string, string>) => void,
 * }} props
 */
export default function DirectorEditApplicantDetails({ application, onSaved }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("edit");
  const [form, setForm] = useState(() => draftFrom(application));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => buildApplicantDetailsCorrection({ ...form, reason: reason || "preview" }, application),
    [form, reason, application]
  );

  function openEditor() {
    setForm(draftFrom(application));
    setReason("");
    setError("");
    setSuccess("");
    setStep("edit");
    setOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setOpen(false);
  }

  function review(event) {
    event.preventDefault();
    setError("");
    const changed = buildApplicantDetailsCorrection({ ...form, reason: "Review only" }, application);
    if (!changed.ok) {
      setError(changed.error);
      return;
    }
    setStep("confirm");
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/director/applications/${application.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the correction.");
        return;
      }
      onSaved?.(data.application || form);
      setSuccess("Applicant details updated.");
      setOpen(false);
    } catch {
      setError("Could not save the correction.");
    } finally {
      setSaving(false);
    }
  }

  const changedFields = preview.ok ? Object.keys(preview.newValue) : [];

  return (
    <div>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex items-center gap-1.5 rounded-lg border border-royal/20 bg-white px-3 py-1.5 text-xs font-medium text-royal hover:bg-royal/5"
      >
        <Pencil size={14} />
        Edit Details
      </button>
      {success ? <p className="mt-2 text-xs font-medium text-green-700">{success}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="edit-applicant-details-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-applicant-details-title" className="text-lg font-bold text-gray-900">
                  Edit Details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Correct applicant information. Status, assessments, assignments, and documents stay unchanged.
                </p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close" className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {error ? (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            {step === "edit" ? (
              <form onSubmit={review} className="space-y-4">
                <label className="block text-xs font-medium text-gray-600">
                  Full Name
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">School / University</p>
                  <InstitutionSelect
                    value={form.university}
                    onChange={(university) => setForm((f) => ({ ...f, university }))}
                  />
                </div>
                <label className="block text-xs font-medium text-gray-600">
                  Hometown
                  <input
                    value={form.hometown}
                    onChange={(e) => setForm((f) => ({ ...f, hometown: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Course / Programme
                  <input
                    value={form.program}
                    onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Gender
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" onClick={closeEditor} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white">
                    Review changes
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={save} className="space-y-4">
                <ul className="space-y-2 text-sm text-gray-800">
                  {changedFields.map((field) => (
                    <li key={field} className="rounded-lg bg-gray-50 px-3 py-2">
                      <span className="font-medium">{LABELS[field]}</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {displayValue(field, preview.oldValue[field])} → {displayValue(field, preview.newValue[field])}
                      </span>
                    </li>
                  ))}
                </ul>
                <label className="block text-xs font-medium text-gray-600">
                  Reason for correction
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Why is this correction needed?"
                  />
                </label>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("edit")}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function draftFrom(application) {
  return {
    full_name: application?.full_name || "",
    university: application?.university || "",
    hometown: application?.hometown || "",
    program: application?.program || "",
    gender: application?.gender === "male" || application?.gender === "female" ? application.gender : "",
  };
}
