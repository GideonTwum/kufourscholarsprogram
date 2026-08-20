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
  Award,
  ImageIcon,
  Plus,
  Share2,
  IdCard,
  ExternalLink,
} from "lucide-react";
import {
  MAX_FILE_SIZE_DOCS,
  MAX_FILE_SIZE_PHOTO,
  MAX_LEADERSHIP_FILES,
  MAX_RECOMMENDATION_LETTERS,
  MIN_RECOMMENDATION_LETTERS,
  CV_PERSONAL_STATEMENT_HINT,
  getLeadershipEvidencePaths,
  getRecommendationLetterPaths,
} from "@/lib/application-validation";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
const STUDENT_ID_EXTS = ["pdf", ...IMAGE_EXTS];

function SignedViewLink({ path, label = "View" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!path) {
        setUrl(null);
        return;
      }
      try {
        const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
        const json = await res.json();
        if (!cancelled) setUrl(json.url || null);
      } catch {
        if (!cancelled) setUrl(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!path) return null;
  if (!url) {
    return <span className="text-xs text-gray-400">Preparing link…</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-royal hover:text-gold"
    >
      <ExternalLink size={12} />
      {label}
    </a>
  );
}

export default function Documents({ data, onChange, userId, errors = {} }) {
  const [uploading, setUploading] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const supabase = createClient();

  const leadershipPaths = getLeadershipEvidencePaths(data);
  const recommendationPaths = getRecommendationLetterPaths(data);

  function clearUploadError(field) {
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function uploadToApplications(file, fieldKey, folder, allowedExts, pdfOnlyMessage) {
    if (!file || !userId) return;
    if (file.size > MAX_FILE_SIZE_DOCS) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: `File too large. Max 5MB.${pdfOnlyMessage ? " PDF only." : ""}`,
      }));
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (!allowedExts.includes(ext)) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: pdfOnlyMessage || "Use PDF, JPG, PNG, or WebP.",
      }));
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
    } else if (fieldKey === "recommendation_add") {
      onChange((prev) => {
        const cur = getRecommendationLetterPaths(prev);
        if (cur.length >= MAX_RECOMMENDATION_LETTERS) return prev;
        const next = [...cur, filePath];
        return {
          ...prev,
          recommendation_urls: next,
          recommendation_url: next[0] || null,
        };
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
      setUploadErrors((prev) => ({ ...prev, [fieldKey]: "Image must be under 5MB." }));
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (!IMAGE_EXTS.includes(ext)) {
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

  function removeRecommendationAt(index) {
    onChange((prev) => {
      const cur = [...getRecommendationLetterPaths(prev)];
      cur.splice(index, 1);
      return {
        ...prev,
        recommendation_urls: cur,
        recommendation_url: cur[0] || null,
      };
    });
  }

  function renderPdfUpload(label, field, folder, Icon, hint, required = true) {
    const hasFile = !!data[field];
    const err = errors[field] || uploadErrors[field];
    const hasError = !!err;
    return (
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Icon size={16} />
          {label} {required ? <span className="text-red-500">*</span> : null}
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
                  if (f) uploadToApplications(f, field, folder, ["pdf"], "Only PDF format is allowed.");
                  e.target.value = "";
                }}
              />
            </label>
            {hasFile && (
              <div className="flex shrink-0 items-center gap-2">
                <SignedViewLink path={data[field]} />
                <button
                  type="button"
                  onClick={() => removeFile(field)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          {err && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {err}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      </div>
    );
  }

  function renderPrivateImageUpload(label, field, folder, handleLabel) {
    const hasFile = !!data[field];
    const err = errors[field] || uploadErrors[field];
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label} <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          Official account: <span className="font-semibold text-gray-700">{handleLabel}</span>
        </p>
        <div
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 ${
            hasFile
              ? "border-green-200 bg-green-50"
              : err
                ? "border-red-200 bg-red-50/30"
                : "border-gray-200 hover:border-gold hover:bg-gold/5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-center">
              {uploading[field] ? (
                <Loader2 size={20} className="animate-spin text-royal" />
              ) : hasFile ? (
                <>
                  <CheckCircle2 size={20} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">Screenshot uploaded</span>
                </>
              ) : (
                <>
                  <FileUp size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Upload JPG/PNG/WebP screenshot</span>
                </>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadToApplications(f, field, folder, IMAGE_EXTS, "Use JPG, PNG, or WebP.");
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {hasFile ? (
              <div className="flex shrink-0 items-center gap-2">
                <SignedViewLink path={data[field]} label="View" />
                <button
                  type="button"
                  onClick={() => removeFile(field)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  title="Remove screenshot"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
          {err ? (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {err}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const photoField = "photo_url";
  const hasPhoto = !!data.photo_url;
  const photoErr = errors[photoField] || uploadErrors[photoField];
  const studentErr = errors.student_id_path || uploadErrors.student_id_path;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Stage 1 Documents</h2>
        <p className="mt-1 text-sm text-gray-500">
          Passport photo: JPG/PNG/WebP, max 5MB. Documents: PDF (or image where noted), max 5MB each.
          This passport photo will be used as your profile picture.
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

      {renderPdfUpload(
        "CV / Personal Statement",
        "cv_personal_statement_url",
        "cv",
        FileText,
        CV_PERSONAL_STATEMENT_HINT
      )}
      {renderPdfUpload(
        "Academic Transcript",
        "academic_transcript_url",
        "transcript",
        FileText,
        "Official academic transcript in PDF"
      )}

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <IdCard size={16} />
          Student ID <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">Upload a clear PDF or image of your student ID card.</p>
        <div
          className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 ${
            data.student_id_path
              ? "border-green-200 bg-green-50"
              : studentErr
                ? "border-red-200 bg-red-50/30"
                : "border-gray-200 hover:border-gold hover:bg-gold/5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 py-3 text-center">
              {uploading.student_id_path ? (
                <Loader2 size={20} className="animate-spin text-royal" />
              ) : data.student_id_path ? (
                <>
                  <CheckCircle2 size={20} className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">Student ID uploaded</span>
                </>
              ) : (
                <>
                  <FileUp size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Upload PDF, JPG, PNG, or WebP</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadToApplications(
                      f,
                      "student_id_path",
                      "student-id",
                      STUDENT_ID_EXTS,
                      "Use PDF, JPG, PNG, or WebP."
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {data.student_id_path ? (
              <div className="flex shrink-0 items-center gap-2">
                <SignedViewLink path={data.student_id_path} label="View" />
                <button
                  type="button"
                  onClick={() => removeFile("student_id_path")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  title="Remove Student ID"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
          {studentErr ? (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle size={12} />
              {studentErr}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText size={16} /> Recommendation Letters <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          Upload at least {MIN_RECOMMENDATION_LETTERS} recommendation letters (PDF). You may add up to{" "}
          {MAX_RECOMMENDATION_LETTERS}.
        </p>
        <div className="space-y-3">
          {recommendationPaths.map((path, index) => (
            <div
              key={`${path}-${index}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-green-800">
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="truncate">Recommendation letter {index + 1} uploaded</span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <SignedViewLink path={path} />
                <button
                  type="button"
                  onClick={() => removeRecommendationAt(index)}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  title="Remove this file"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          {recommendationPaths.length < MAX_RECOMMENDATION_LETTERS && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-600 transition-colors hover:border-gold hover:bg-gold/5">
              {uploading.recommendation_add ? (
                <Loader2 size={18} className="animate-spin text-royal" />
              ) : (
                <>
                  <Plus size={18} className="text-royal" />
                  {recommendationPaths.length === 0
                    ? "Upload recommendation letter (PDF)"
                    : "Add another recommendation letter"}
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadToApplications(
                      f,
                      "recommendation_add",
                      "recommendation",
                      ["pdf"],
                      "Only PDF format is allowed."
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        {(errors.recommendation_urls || uploadErrors.recommendation_add) && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.recommendation_urls || uploadErrors.recommendation_add}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Award size={16} /> Evidence of Leadership{" "}
          <span className="font-normal text-gray-500">(Optional — upload if available)</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          Upload certificates, awards, letters, or other proof if you have them (max {MAX_LEADERSHIP_FILES} PDFs).
        </p>
        <div className="space-y-3">
          {leadershipPaths.map((path, index) => (
            <div
              key={`${path}-${index}`}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-green-800">
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="truncate">Leadership file {index + 1} uploaded</span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <SignedViewLink path={path} />
                <button
                  type="button"
                  onClick={() => removeLeadershipAt(index)}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  title="Remove this file"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          {leadershipPaths.length < MAX_LEADERSHIP_FILES && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm text-gray-600 transition-colors hover:border-gold hover:bg-gold/5">
              {uploading.leadership_add ? (
                <Loader2 size={18} className="animate-spin text-royal" />
              ) : (
                <>
                  <Plus size={18} className="text-royal" />
                  {leadershipPaths.length === 0
                    ? "Upload leadership evidence (PDF) — optional"
                    : "Add another PDF"}
                </>
              )}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    uploadToApplications(
                      f,
                      "leadership_add",
                      "leadership",
                      ["pdf"],
                      "Only PDF format is allowed."
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-royal/15 bg-royal/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-royal">
          <Share2 size={16} /> Follow KSP on Social Media
        </h3>
        <p className="mt-2 text-sm text-gray-700">
          As part of your application, please follow the Kufuor Scholars Program on the official
          accounts below and upload a screenshot showing that you are following each account.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Uploading a screenshot confirms evidence was provided; the system does not independently
          verify your social account.
        </p>
        <div className="mt-4 space-y-4">
          {renderPrivateImageUpload(
            "TikTok Follow Screenshot",
            "ksp_tiktok_follow_screenshot_path",
            "social-evidence/tiktok",
            "@kufuorscholars"
          )}
          {renderPrivateImageUpload(
            "LinkedIn Follow Screenshot",
            "ksp_linkedin_follow_screenshot_path",
            "social-evidence/linkedin",
            "Kufuor Scholars Program"
          )}
          {renderPrivateImageUpload(
            "Instagram Follow Screenshot",
            "ksp_instagram_follow_screenshot_path",
            "social-evidence/instagram",
            "@kufuor_scholars_program"
          )}
        </div>
      </div>
    </div>
  );
}
