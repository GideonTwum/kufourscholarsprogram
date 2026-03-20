"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileUp, FileText, Loader2, CheckCircle2, X, AlertCircle, Award, ImageIcon, Plus } from "lucide-react";
import { MAX_FILE_SIZE_DOCS, MAX_FILE_SIZE_PHOTO, getLeadershipEvidencePaths } from "@/lib/application-validation";

const MAX_LEADERSHIP_FILES = 10;

export default function Documents({ data, onChange, userId, errors = {} }) {
  const [uploading, setUploading] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const supabase = createClient();

  const leadershipPaths = getLeadershipEvidencePaths(data);

  function clearUploadError(field) {
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function uploadPdf(file, fieldKey, folder) {
    if (!file || !userId) return;
    if (file.size > MAX_FILE_SIZE_DOCS) {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: `File too large. Max 5MB. PDF only.` }));
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "pdf") {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: "Only PDF format is allowed." }));
      return;
    }
    setUploading((prev) => ({ ...prev, [fieldKey]: true }));
    clearUploadError(fieldKey);
    const filePath = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("applications").upload(filePath, file, { upsert: true });
    if (error) {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: error.message || "Upload failed." }));
    } else if (fieldKey === "leadership_add") {
      onChange((prev) => {
        const cur = getLeadershipEvidencePaths(prev);
        if (cur.length >= MAX_LEADERSHIP_FILES) return prev;
        return { ...prev, leadership_evidence_urls: [...cur, filePath] };
      });
    } else {
      onChange((prev) => ({ ...prev, [fieldKey]: filePath }));
    }
    setUploading((prev) => ({ ...prev, [fieldKey]: false }));
  }

  async function uploadPassportImage(file) {
    const fieldKey = "photo_url";
    if (!file || !userId) return;
    if (file.size > MAX_FILE_SIZE_PHOTO) {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: "Image must be under 2MB." }));
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: "Use JPG, PNG, or WebP." }));
      return;
    }
    setUploading((prev) => ({ ...prev, [fieldKey]: true }));
    clearUploadError(fieldKey);
    const path = `${userId}/passport-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: error.message || "Upload failed." }));
    } else {
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (publicUrl) onChange((prev) => ({ ...prev, photo_url: publicUrl }));
    }
    setUploading((prev) => ({ ...prev, [fieldKey]: false }));
  }

  function removeFile(field) {
    onChange((prev) => ({ ...prev, [field]: "" }));
    clearUploadError(field);
  }

  function removeLeadershipAt(index) {
    onChange((prev) => {
      const cur = [...getLeadershipEvidencePaths(prev)];
      cur.splice(index, 1);
      return { ...prev, leadership_evidence_urls: cur };
    });
  }

  function renderPdfUpload(label, field, folder, Icon, hint) {
    const hasFile = !!data[field];
    const err = errors[field] || uploadErrors[field];
    const hasError = !!err;
    return (
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Icon size={16} />
          {label} <span className="text-red-500">*</span>
        </label>
        <div
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${hasFile ? "border-green-200 bg-green-50" : hasError ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-gold hover:bg-gold/5"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-4 text-center">
              {uploading[field] ? (
                <Loader2 size={20} className="animate-spin text-royal" />
              ) : hasFile ? (
                <>
                  <CheckCircle2 size={20} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">Uploaded</span>
                </>
              ) : (
                <>
                  <FileUp size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Click to upload PDF</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPdf(f, field, folder);
                  e.target.value = "";
                }}
              />
            </label>
            {hasFile && (
              <button
                type="button"
                onClick={() => removeFile(field)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                title="Remove file"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {(errors[field] || uploadErrors[field]) && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {errors[field] || uploadErrors[field]}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      </div>
    );
  }

  const photoField = "photo_url";
  const hasPhoto = !!data.photo_url;
  const photoErr = errors[photoField] || uploadErrors[photoField];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Stage 1 Documents</h2>
        <p className="mt-1 text-sm text-gray-500">
          Passport photo: JPG/PNG/WebP, max 2MB. Other documents: PDF, max 5MB each. This photo will be used as your
          profile picture.
        </p>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <ImageIcon size={16} /> Passport photograph <span className="text-red-500">*</span>
        </label>
        <div
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 transition-colors ${hasPhoto ? "border-green-200 bg-green-50" : photoErr ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-gold hover:bg-gold/5"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-4 text-center sm:justify-start sm:px-2">
              {uploading[photoField] ? (
                <Loader2 size={20} className="animate-spin text-royal" />
              ) : hasPhoto ? (
                <div className="flex items-center gap-3">
                  <img src={data.photo_url} alt="Passport preview" className="h-16 w-16 rounded-lg object-cover ring-2 ring-green-200" />
                  <span className="text-sm font-medium text-green-700">Photo uploaded</span>
                </div>
              ) : (
                <>
                  <FileUp size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Recent passport-style photo (face visible, plain background)</span>
                </>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPassportImage(f);
                  e.target.value = "";
                }}
              />
            </label>
            {hasPhoto && (
              <button
                type="button"
                onClick={() => removeFile(photoField)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                title="Remove photo"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {photoErr && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {photoErr}
            </p>
          )}
        </div>
      </div>

      {renderPdfUpload("CV / Personal Statement", "cv_personal_statement_url", "cv", FileText, "Combined CV and personal statement in one PDF")}
      {renderPdfUpload("Academic Transcript", "academic_transcript_url", "transcript", FileText, "Official academic transcript in PDF")}

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Award size={16} /> Evidence of leadership <span className="text-red-500">*</span>
          <span className="font-normal text-gray-500">(one or more PDFs)</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">Upload certificates, awards, letters, or other proof. Add multiple files if needed (max {MAX_LEADERSHIP_FILES}).</p>

        <div className="space-y-3">
          {leadershipPaths.map((path, index) => (
            <div
              key={`${path}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 size={16} className="shrink-0" />
                Leadership file {index + 1} uploaded
              </span>
              <button
                type="button"
                onClick={() => removeLeadershipAt(index)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600"
                title="Remove this file"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {leadershipPaths.length < MAX_LEADERSHIP_FILES && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-600 transition-colors hover:border-gold hover:bg-gold/5">
              {uploading.leadership_add ? (
                <Loader2 size={18} className="animate-spin text-royal" />
              ) : (
                <>
                  <Plus size={18} className="text-royal" />
                  {leadershipPaths.length === 0 ? "Upload leadership evidence (PDF)" : "Add another PDF"}
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPdf(f, "leadership_add", "leadership");
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {(errors.leadership_evidence_urls || uploadErrors.leadership_add) && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.leadership_evidence_urls || uploadErrors.leadership_add}
          </p>
        )}
      </div>

      {renderPdfUpload("Recommendation Letter", "recommendation_url", "recommendation", FileText, "Letter from HOD, lecturer, or academic referee in PDF")}
    </div>
  );
}
