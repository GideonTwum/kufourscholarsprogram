"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  Eye,
  AlertCircle,
  XCircle,
} from "lucide-react";
import PersonalInfo from "./steps/PersonalInfo";
import AcademicInfo from "./steps/AcademicInfo";
import Documents from "./steps/Documents";
import ReviewSubmit from "./steps/ReviewSubmit";
import {
  validateStep,
  validateForSubmit,
  STEP_VALIDATION_FIELDS,
  getLeadershipEvidencePaths,
} from "@/lib/application-validation";

const stepLabels = ["Personal", "Academic", "Documents", "Review"];

const DOC_FIELDS = [
  "cv_personal_statement_url",
  "academic_transcript_url",
  "leadership_evidence_urls",
  "recommendation_url",
  "photo_url",
];

function normalizeLeadershipFromExisting(existing) {
  const raw = existing.leadership_evidence_urls;
  if (Array.isArray(raw) && raw.length) return raw.filter((x) => typeof x === "string" && x);
  const leg = (existing.leadership_evidence_url || "").trim();
  return leg ? [leg] : [];
}

function buildApplicationPayload(data, userId, status, submittedAt = null) {
  const leadership = Array.isArray(data.leadership_evidence_urls)
    ? data.leadership_evidence_urls.filter((x) => typeof x === "string" && x)
    : [];
  return {
    ...data,
    leadership_evidence_urls: leadership,
    leadership_evidence_url: leadership[0] || null,
    user_id: userId,
    status,
    updated_at: new Date().toISOString(),
    ...(submittedAt ? { submitted_at: submittedAt } : {}),
  };
}

function useApplicationDocUrls(data) {
  const [docUrls, setDocUrls] = useState({});

  useEffect(() => {
    async function fetchUrls() {
      const urls = {};
      const pdfFields = {
        cv_personal_statement_url: data.cv_personal_statement_url || data.cv_url,
        academic_transcript_url: data.academic_transcript_url,
        recommendation_url: data.recommendation_url,
      };
      for (const [field, path] of Object.entries(pdfFields)) {
        if (!path) continue;
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const json = await res.json();
          if (json.url) urls[field] = json.url;
        } catch (_) {}
      }
      const leadership = getLeadershipEvidencePaths(data);
      urls.leadership = [];
      for (const path of leadership) {
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const json = await res.json();
          urls.leadership.push(json.url || null);
        } catch (_) {
          urls.leadership.push(null);
        }
      }
      const p = data.photo_url;
      if (p) {
        if (/^https?:\/\//i.test(p)) urls.photo_url = p;
        else {
          try {
            const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(p)}`);
            const json = await res.json();
            if (json.url) urls.photo_url = json.url;
          } catch (_) {}
        }
      }
      setDocUrls(urls);
    }
    if (data && Object.keys(data).length) fetchUrls();
  }, [
    data?.cv_personal_statement_url,
    data?.cv_url,
    data?.academic_transcript_url,
    data?.leadership_evidence_url,
    data?.leadership_evidence_urls,
    data?.recommendation_url,
    data?.photo_url,
  ]);

  return docUrls;
}

function ApplicationReadOnlyView({ data }) {
  const docUrls = useApplicationDocUrls(data);
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <ReviewSubmit data={data} goToStep={() => {}} readOnly docUrls={docUrls} />
    </div>
  );
}

export default function ApplicationPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [userId, setUserId] = useState(null);
  const [appId, setAppId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitOutcome, setSubmitOutcome] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const docUrls = useApplicationDocUrls(data);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

      const { data: existing } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        const isNonDraft = existing.status !== "draft";
        if (isNonDraft) {
          setReadOnly(true);
        }
        setAppId(existing.id);
        setData({
          full_name: existing.full_name || profile?.full_name || "",
          date_of_birth: existing.date_of_birth || "",
          phone: existing.phone || "",
          address: existing.address || "",
          hometown: existing.hometown || "",
          region: existing.region || "",
          country_of_origin: existing.country_of_origin || "",
          nationality: existing.nationality || "",
          emergency_contact_name: existing.emergency_contact_name || "",
          emergency_contact_number: existing.emergency_contact_number || "",
          emergency_contact_2_name: existing.emergency_contact_2_name || "",
          emergency_contact_2_number: existing.emergency_contact_2_number || "",
          linkedin_url: existing.linkedin_url || "",
          instagram_url: existing.instagram_url || "",
          facebook_url: existing.facebook_url || "",
          tiktok_url: existing.tiktok_url || "",
          snapchat_url: existing.snapchat_url || "",
          twitter_url: existing.twitter_url || "",
          junior_high_school: existing.junior_high_school || "",
          senior_high_school: existing.senior_high_school || "",
          university: existing.university || "",
          student_id: existing.student_id || "",
          program: existing.program || "",
          year_of_study: existing.year_of_study || "",
          grade_type: existing.grade_type || "",
          gpa: existing.gpa || "",
          confirms_ghana_enrollment: !!existing.confirms_ghana_enrollment,
          cv_personal_statement_url: existing.cv_personal_statement_url || existing.cv_url || "",
          academic_transcript_url: existing.academic_transcript_url || "",
          leadership_evidence_urls: normalizeLeadershipFromExisting(existing),
          recommendation_url: existing.recommendation_url || "",
          photo_url: existing.photo_url || "",
        });
      } else {
        setData({ full_name: profile?.full_name || "" });
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (readOnly || submitted || loading) return;
    const timer = setTimeout(() => {
      const stepErrors = validateStep(step, data);
      const filtered = {};
      for (const [key, msg] of Object.entries(stepErrors)) {
        const v = data[key];
        const isEmpty =
          v == null ||
          (typeof v === "string" && !v.trim()) ||
          v === false ||
          (Array.isArray(v) && v.length === 0) ||
          (typeof v === "boolean" && key !== "confirms_ghana_enrollment" && !v);
        const isRequiredMsg = /is required|required\.|at least one/i.test(String(msg));
        if (isEmpty && isRequiredMsg) continue;
        if (key === "confirms_ghana_enrollment" && !data.confirms_ghana_enrollment) {
          const academicStarted =
            !!data.university?.trim() &&
            !!data.program?.trim() &&
            !!data.year_of_study &&
            !!data.grade_type &&
            !!data.gpa?.trim();
          if (!academicStarted) continue;
        }
        filtered[key] = msg;
      }
      setErrors((prev) => {
        const next = { ...prev };
        for (const k of STEP_VALIDATION_FIELDS[step] || []) {
          delete next[k];
        }
        return { ...next, ...filtered };
      });
    }, 320);
    return () => clearTimeout(timer);
  }, [data, step, readOnly, submitted, loading]);

  async function syncProfilePhoto(photoUrl) {
    if (!photoUrl?.trim() || !userId) return;
    await supabase
      .from("profiles")
      .update({ photo_url: photoUrl.trim(), updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  async function saveDraft() {
    setSaving(true);
    const payload = buildApplicationPayload(data, userId, "draft");
    if (appId) {
      await supabase.from("applications").update(payload).eq("id", appId);
    } else {
      const { data: created } = await supabase.from("applications").insert(payload).select("id").single();
      if (created) setAppId(created.id);
    }
    if (payload.photo_url) await syncProfilePhoto(payload.photo_url);
    setSaving(false);
  }

  function handleNext() {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    saveDraft().then(() => setStep((s) => s + 1));
  }

  async function handleSubmit() {
    const allErrors = validateForSubmit(data);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const personalKeys = [
        "full_name",
        "date_of_birth",
        "phone",
        "address",
        "country_of_origin",
        "nationality",
        "emergency_contact_name",
        "emergency_contact_number",
        "emergency_contact_2_name",
        "emergency_contact_2_number",
        "linkedin_url",
      ];
      const academicKeys = ["university", "program", "year_of_study", "grade_type", "gpa", "confirms_ghana_enrollment"];
      const docKeys = DOC_FIELDS;
      const errKeys = Object.keys(allErrors);
      if (errKeys.some((k) => personalKeys.includes(k))) setStep(0);
      else if (errKeys.some((k) => academicKeys.includes(k))) setStep(1);
      else if (errKeys.some((k) => docKeys.includes(k))) setStep(2);
      return;
    }
    setSubmitting(true);
    setErrors({});
    const payload = buildApplicationPayload(data, userId, "draft");
    try {
      const res = await fetch("/api/applications/submit-stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: appId,
          data: payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors({ _submit: json.error || "Submission failed" });
        setSubmitting(false);
        return;
      }
      if (payload.photo_url) await syncProfilePhoto(payload.photo_url);
      if (json.outcome === "rejected") {
        setSubmitOutcome("rejected");
        setRejectionReason(json.rejection_reason || null);
        if (json.application_id) setAppId(json.application_id);
      } else {
        setSubmitOutcome("pending");
        if (json.application_id) setAppId(json.application_id);
      }
      setSubmitted(true);
    } catch {
      setErrors({ _submit: "Network error. Please try again." });
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  if (submitted) {
    if (submitOutcome === "rejected") {
      return (
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <XCircle size={48} className="mx-auto text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Application not eligible</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your submission did not meet the published eligibility requirements.
          </p>
          {rejectionReason && (
            <p className="mt-4 rounded-lg bg-red-50 p-4 text-left text-sm text-red-800">{rejectionReason}</p>
          )}
          <button
            type="button"
            onClick={() => router.push("/applicant")}
            className="mt-6 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto text-green-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Stage 1 Submitted</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your application status is <strong>Pending</strong> while we review your file. Check your email and the dashboard for updates.
        </p>
        <button onClick={() => router.push("/applicant")} className="mt-6 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90">Go to Dashboard</button>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-700">
          <Eye size={16} />
          Your Stage 1 application has been submitted — status <strong>Pending</strong>.
        </div>
        <ApplicationReadOnlyView data={data} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stage 1: Initial Application</h1>
        <p className="mt-1 text-sm text-gray-500">Complete all steps to submit your Stage 1 application.</p>
        {process.env.NEXT_PUBLIC_APPLICATION_GUIDE_VIDEO_ID ? (
          <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-gray-200 bg-black/5">
            <iframe
              title="Application guide"
              className="h-full min-h-[200px] w-full"
              src={`https://www.youtube.com/embed/${process.env.NEXT_PUBLIC_APPLICATION_GUIDE_VIDEO_ID}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <Link
          href="/apply"
          className="mt-4 inline-flex rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-royal hover:bg-gold/20"
        >
          New to the program? Apply now
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-royal text-white" : i === step ? "bg-gold text-royal" : "bg-gray-100 text-gray-400"}`}>
                  {i < step ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                <span className="mt-1 hidden text-[10px] font-medium text-gray-500 sm:block">{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-royal" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Please fix the following before continuing:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        {step === 0 && <PersonalInfo data={data} onChange={setData} errors={errors} />}
        {step === 1 && <AcademicInfo data={data} onChange={setData} errors={errors} />}
        {step === 2 && <Documents data={data} onChange={setData} userId={userId} errors={errors} />}
        {step === 3 && <ReviewSubmit data={data} goToStep={setStep} errors={errors} docUrls={docUrls} />}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button onClick={saveDraft} disabled={saving} className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft
          </button>
        </div>
        {step < 3 ? (
          <button onClick={handleNext} disabled={saving} className="flex items-center gap-1 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-1 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold/90 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit Stage 1
          </button>
        )}
      </div>
    </div>
  );
}
