"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FileUp,
  FileText,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import {
  CONCEPT_NOTE_ONE_PAGE_MESSAGE,
  CONCEPT_NOTE_TITLE_MAX,
  MAX_FILE_SIZE_DOCS,
  normalizeConceptNoteTitle,
} from "@/lib/application-validation";

export default function ConceptNote({ data, onChange, userId, errors = {}, readOnly = false }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewUrl, setViewUrl] = useState(null);
  const [loadingView, setLoadingView] = useState(false);
  const supabase = createClient();

  const path = typeof data.concept_note_path === "string" ? data.concept_note_path : "";
  const titleErr = errors.concept_note_title;
  const pathErr = errors.concept_note_path || uploadError;

  useEffect(() => {
    let cancelled = false;
    async function loadView() {
      if (!path) {
        setViewUrl(null);
        return;
      }
      setLoadingView(true);
      try {
        const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
        const json = await res.json();
        if (!cancelled) setViewUrl(json.url || null);
      } catch {
        if (!cancelled) setViewUrl(null);
      }
      if (!cancelled) setLoadingView(false);
    }
    loadView();
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function uploadPdf(file) {
    if (readOnly || !file || !userId) return;
    if (file.size > MAX_FILE_SIZE_DOCS) {
      setUploadError("File too large. Max 5MB. PDF only.");
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "pdf") {
      setUploadError("Only PDF format is allowed.");
      return;
    }
    setUploading(true);
    setUploadError("");
    const filePath = `${userId}/concept-note/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.pdf`;
    const { error } = await supabase.storage
      .from("applications")
      .upload(filePath, file, { upsert: true });
    if (error) {
      setUploadError(error.message || "Upload failed.");
    } else {
      onChange((prev) => ({ ...prev, concept_note_path: filePath }));
    }
    setUploading(false);
  }

  function removeFile() {
    if (readOnly) return;
    onChange((prev) => ({ ...prev, concept_note_path: "" }));
    setUploadError("");
    setViewUrl(null);
  }

  function handleTitleChange(e) {
    if (readOnly) return;
    onChange((prev) => ({ ...prev, concept_note_title: e.target.value }));
  }

  function handleTitleBlur() {
    if (readOnly) return;
    const normalized = normalizeConceptNoteTitle(data.concept_note_title);
    if (normalized !== (data.concept_note_title || "")) {
      onChange((prev) => ({ ...prev, concept_note_title: normalized }));
    }
  }

  const displayName = path ? path.split("/").pop() : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Lightbulb size={20} className="text-royal" />
          ONE-PAGE CONCEPT NOTE
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Identify and explore one community problem of your choice and prepare a one-page
          Concept Note proposing a practical response to the problem.
        </p>
      </div>

      <div className="rounded-lg border border-royal/15 bg-royal/5 p-4 text-sm text-gray-700">
        <p className="font-semibold text-royal">Your Concept Note should address:</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>Identified Problem/Theme</strong> — Clearly state and briefly describe the
            problem you have identified.
          </li>
          <li>
            <strong>Causes</strong> — What are the major causes or contributing factors?
          </li>
          <li>
            <strong>Effects/Consequences</strong> — How does the problem affect individuals,
            families, the community, or society?
          </li>
          <li>
            <strong>Proposed Intervention Activities</strong> — What practical actions or
            interventions would you undertake to address the problem?
          </li>
          <li>
            <strong>Expected Outcomes</strong> — What positive and measurable changes do you
            expect your intervention to achieve?
          </li>
        </ol>
        <p className="mt-3 text-xs text-gray-600">
          The community problem may relate to a contemporary social issue, something you have
          observed or experienced, young people, education, health, the environment, employment,
          governance, sanitation, community development, or another significant challenge.
        </p>
        <p className="mt-3 text-sm font-semibold text-royal">
          Important: Applicants are encouraged to demonstrate critical thinking, creativity,
          leadership potential, problem-solving ability, and a genuine understanding of the
          community they seek to serve.
        </p>
        <p className="mt-3 text-sm font-bold text-gray-900">{CONCEPT_NOTE_ONE_PAGE_MESSAGE}</p>
        <p className="mt-1 text-xs text-gray-500">
          Upload a single PDF page. Multi-page files may be rejected during review even if upload
          succeeds.
        </p>
      </div>

      <div>
        <label
          htmlFor="concept-note-title"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Concept Note Title <span className="text-red-500">*</span>
        </label>
        <input
          id="concept-note-title"
          type="text"
          value={data.concept_note_title || ""}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          disabled={readOnly}
          maxLength={CONCEPT_NOTE_TITLE_MAX}
          placeholder="Improving Waste Management Among Households in Madina"
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-gray-50 ${
            titleErr ? "border-red-300" : "border-gray-200"
          }`}
        />
        {titleErr ? <p className="mt-1 text-xs text-red-600">{titleErr}</p> : null}
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText size={16} />
          Upload Concept Note <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          Upload your one-page Concept Note in PDF format.
        </p>
        <div
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${
            path
              ? "border-green-200 bg-green-50"
              : pathErr
                ? "border-red-200 bg-red-50/30"
                : "border-gray-200 hover:border-gold hover:bg-gold/5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            {!readOnly ? (
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-4 text-center">
                {uploading ? (
                  <Loader2 size={20} className="animate-spin text-royal" />
                ) : path ? (
                  <>
                    <CheckCircle2 size={20} className="text-green-600" />
                    <span className="text-sm font-medium text-green-700">Uploaded — click to replace</span>
                  </>
                ) : (
                  <>
                    <FileUp size={20} className="text-gray-400" />
                    <span className="text-sm text-gray-500">Click to upload PDF</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={uploading || readOnly}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPdf(file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : path ? (
              <div className="flex flex-1 items-center justify-center gap-2 py-4">
                <CheckCircle2 size={20} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">Uploaded</span>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500">Not uploaded</p>
            )}
            {path && !readOnly ? (
              <button
                type="button"
                onClick={removeFile}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove Concept Note"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          {path ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-green-100 pt-2 text-xs text-gray-600">
              <span className="truncate font-mono">{displayName}</span>
              {loadingView ? (
                <span className="text-amber-600">Preparing view…</span>
              ) : viewUrl ? (
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-royal hover:text-gold"
                >
                  View Concept Note <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-amber-600">View unavailable</span>
              )}
            </div>
          ) : null}
        </div>
        {pathErr ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={12} /> {pathErr}
          </p>
        ) : null}
      </div>
    </div>
  );
}
