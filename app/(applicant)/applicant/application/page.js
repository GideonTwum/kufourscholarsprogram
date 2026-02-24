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
  FileText,
  Eye,
  AlertCircle,
} from "lucide-react";
import PersonalInfo from "./steps/PersonalInfo";
import AcademicInfo from "./steps/AcademicInfo";
import EssayVideo from "./steps/EssayVideo";
import Documents from "./steps/Documents";
import ReviewSubmit from "./steps/ReviewSubmit";
import { validateStep, validateForSubmit } from "@/lib/application-validation";

const stepLabels = ["Personal", "Academic", "Essay & Video", "Documents", "Review"];

function ApplicationReadOnlyView({ data }) {
  const [docUrls, setDocUrls] = useState({});

  useEffect(() => {
    const paths = { cv_url: data.cv_url, recommendation_url: data.recommendation_url, photo_url: data.photo_url };
    const fetchUrls = async () => {
      const urls = {};
      for (const [field, path] of Object.entries(paths)) {
        if (!path) continue;
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const json = await res.json();
          if (json.url) urls[field] = json.url;
        } catch (_) {}
      }
      setDocUrls(urls);
    };
    fetchUrls();
  }, [data.cv_url, data.recommendation_url, data.photo_url]);

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
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

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
        if (existing.status !== "draft") {
          setReadOnly(true);
          setData(existing);
          setAppId(existing.id);
          setLoading(false);
          return;
        }
        setAppId(existing.id);
        setData({
          full_name: existing.full_name || profile?.full_name || "",
          date_of_birth: existing.date_of_birth || "",
          phone: existing.phone || "",
          address: existing.address || "",
          nationality: existing.nationality || "",
          university: existing.university || "",
          program: existing.program || "",
          year_of_study: existing.year_of_study || "",
          gpa: existing.gpa || "",
          essay: existing.essay || "",
          video_url: existing.video_url || "",
          cv_url: existing.cv_url || "",
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

  async function saveDraft() {
    setSaving(true);
    const payload = { ...data, user_id: userId, status: "draft", updated_at: new Date().toISOString() };
    if (appId) {
      await supabase.from("applications").update(payload).eq("id", appId);
    } else {
      const { data: created } = await supabase.from("applications").insert(payload).select("id").single();
      if (created) setAppId(created.id);
    }
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
      const personalKeys = ["full_name", "date_of_birth", "phone", "address", "nationality"];
      const academicKeys = ["university", "program", "year_of_study", "gpa"];
      const essayKeys = ["essay", "video_url"];
      const docKeys = ["cv_url", "recommendation_url", "photo_url"];
      const errKeys = Object.keys(allErrors);
      if (errKeys.some((k) => personalKeys.includes(k))) setStep(0);
      else if (errKeys.some((k) => academicKeys.includes(k))) setStep(1);
      else if (errKeys.some((k) => essayKeys.includes(k))) setStep(2);
      else if (errKeys.some((k) => docKeys.includes(k))) setStep(3);
      return;
    }
    setSubmitting(true);
    setErrors({});
    const payload = { ...data, user_id: userId, status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (appId) {
      await supabase.from("applications").update(payload).eq("id", appId);
    } else {
      await supabase.from("applications").insert(payload);
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto text-green-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Application Submitted!</h1>
        <p className="mt-2 text-sm text-gray-500">Your application is now under review. Track your status from the dashboard.</p>
        <button onClick={() => router.push("/applicant")} className="mt-6 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal-light">Go to Dashboard</button>
      </div>
    );
  }

  // Read-only view for submitted applications
  if (readOnly) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-700">
          <Eye size={16} />
          Your application has been submitted and is under review.
        </div>
        <ApplicationReadOnlyView data={data} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Application</h1>
        <p className="mt-1 text-sm text-gray-500">Complete all steps to submit your application.</p>
      </div>

      {/* Step indicator */}
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
        {step === 2 && <EssayVideo data={data} onChange={setData} errors={errors} />}
        {step === 3 && <Documents data={data} onChange={setData} userId={userId} errors={errors} />}
        {step === 4 && <ReviewSubmit data={data} goToStep={setStep} errors={errors} />}
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
        {step < 4 ? (
          <button onClick={handleNext} disabled={saving} className="flex items-center gap-1 rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-1 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold-light disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit Application
          </button>
        )}
      </div>
    </div>
  );
}
