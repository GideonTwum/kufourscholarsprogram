"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileUp, FileText, Loader2, CheckCircle2, X, AlertCircle, Award } from "lucide-react";
import { MAX_FILE_SIZE_DOCS } from "@/lib/application-validation";

export default function Documents({ data, onChange, userId, errors = {} }) {
  const [uploading, setUploading] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const supabase = createClient();

  function clearUploadError(field) {
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function uploadFile(file, field, folder) {
    if (!file || !userId) return;
    if (file.size > MAX_FILE_SIZE_DOCS) {
      setUploadErrors((prev) => ({ ...prev, [field]: `File too large. Max 5MB. PDF only.` }));
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "pdf") {
      setUploadErrors((prev) => ({ ...prev, [field]: "Only PDF format is allowed." }));
      return;
    }
    setUploading((prev) => ({ ...prev, [field]: true }));
    clearUploadError(field);
    const filePath = `${userId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("applications").upload(filePath, file, { upsert: true });
    if (error) {
      setUploadErrors((prev) => ({ ...prev, [field]: error.message || "Upload failed." }));
    } else {
      onChange((prev) => ({ ...prev, [field]: filePath }));
    }
    setUploading((prev) => ({ ...prev, [field]: false }));
  }

  function removeFile(field) {
    onChange((prev) => ({ ...prev, [field]: "" }));
    clearUploadError(field);
  }

  function renderUpload(label, field, folder, Icon, hint) {
    const hasFile = !!data[field];
    const err = errors[field] || uploadErrors[field];
    const hasError = !!err;
    return (
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Icon size={16} />{label} <span className="text-red-500">*</span>
        </label>
        <div className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${hasFile ? "border-green-200 bg-green-50" : hasError ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-gold hover:bg-gold/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-4 text-center">
              {uploading[field] ? <Loader2 size={20} className="animate-spin text-royal" /> : hasFile ? <><CheckCircle2 size={20} className="text-green-600" /><span className="text-sm font-medium text-green-700">Uploaded</span></> : <><FileUp size={20} className="text-gray-400" /><span className="text-sm text-gray-500">Click to upload PDF</span></>}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, field, folder); e.target.value = ""; }} />
            </label>
            {hasFile && (
              <button type="button" onClick={() => removeFile(field)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Remove file">
                <X size={14} />
              </button>
            )}
          </div>
          {(errors[field] || uploadErrors[field]) && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />{errors[field] || uploadErrors[field]}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Stage 1 Documents</h2>
        <p className="mt-1 text-sm text-gray-500">Upload all documents in PDF format. Maximum 5MB per file.</p>
      </div>
      {renderUpload("CV / Personal Statement", "cv_personal_statement_url", "cv", FileText, "Combined CV and personal statement in one PDF")}
      {renderUpload("Academic Transcript", "academic_transcript_url", "transcript", FileText, "Official academic transcript in PDF")}
      {renderUpload("Evidence of Leadership", "leadership_evidence_url", "leadership", Award, "Certificates, awards, or proof of leadership roles in PDF")}
      {renderUpload("Recommendation Letter", "recommendation_url", "recommendation", FileText, "Letter from HOD, lecturer, or academic referee in PDF")}
    </div>
  );
}
