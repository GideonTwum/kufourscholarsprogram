"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Send, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { validateStage2Video } from "@/lib/application-validation";

const STAGE2_PROMPT =
  "Create a 3-minute video on a community problem, outlining the identified problem, cause, effect, intervention, and expected outcome.";

export default function Stage2Page() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [cohortYear, setCohortYear] = useState(String(new Date().getFullYear()));
  const [confirmsPublic, setConfirmsPublic] = useState(false);
  const [confirmsTitle, setConfirmsTitle] = useState(false);
  const [confirmsDescription, setConfirmsDescription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: yearSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "application_cohort_year")
        .maybeSingle();
      const y = String(yearSetting?.value || "").trim();
      if (y && /^\d{4}$/.test(y)) setCohortYear(y);

      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (!app) {
        setError("No application found.");
        setLoading(false);
        return;
      }

      if (app.status !== "stage_1_approved") {
        setApplication(app);
        setLoading(false);
        return;
      }

      setApplication(app);
      setVideoUrl(app.video_youtube_url || "");
      setSubmitted(
        !!app.video_youtube_url &&
          (app.status === "stage_2_submitted" ||
            app.status === "stage_2_approved" ||
            app.status === "called_for_interview" ||
            app.status === "accepted" ||
            app.status === "rejected")
      );
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      video_youtube_url: videoUrl,
      confirms_youtube_public: confirmsPublic,
      confirms_youtube_title_format: confirmsTitle,
      confirms_youtube_description_concept: confirmsDescription,
    };
    const errors = validateStage2Video(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(Object.values(errors)[0] || "Please complete all required confirmations");
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/applications/submit-stage2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.id,
          video_youtube_url: videoUrl.trim(),
          confirms_youtube_public: confirmsPublic,
          confirms_youtube_title_format: confirmsTitle,
          confirms_youtube_description_concept: confirmsDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-300" />
        <p className="mt-4 text-gray-600">No application found.</p>
        <Link href="/applicant" className="mt-4 inline-block text-sm font-semibold text-royal hover:text-gold">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (application.status !== "stage_1_approved" && !submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <Video size={48} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-xl font-bold text-gray-900">Stage 2 Not Yet Available</h2>
        <p className="mt-2 text-sm text-gray-500">
          You will receive access to Stage 2 (Video Submission) once your application has been
          shortlisted by the selection committee.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Current status: {application.status?.replace(/_/g, " ")}
        </p>
        <Link
          href="/applicant"
          className="mt-6 inline-block rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto text-green-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Stage 2 Submitted!</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your video submission has been received. We will be in touch regarding the next steps.
        </p>
        <Link
          href="/applicant"
          className="mt-6 inline-block rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const titleExample = `${application.full_name || "Your Full Name"} - KSP Application ${cohortYear}`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/applicant" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Stage 2: Video Submission</h1>
        <p className="mt-1 text-sm text-gray-500">
          Congratulations on being shortlisted! Submit your poster presentation video.
        </p>

        <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <h3 className="font-semibold text-royal">Video Prompt</h3>
          <p className="mt-2 text-sm text-gray-700">{STAGE2_PROMPT}</p>
        </div>

        <div className="mt-6 space-y-3 rounded-lg border border-royal/15 bg-royal/5 p-4 text-sm text-gray-700">
          <h3 className="font-semibold text-royal">YouTube requirements</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Use your <strong>concept note</strong> as the YouTube video{" "}
              <strong>description</strong>.
            </li>
            <li>
              Set the video <strong>title</strong> exactly in this format:{" "}
              <strong>Full Name - KSP Application {cohortYear}</strong>
              <span className="mt-1 block text-xs text-gray-500">Example: {titleExample}</span>
            </li>
            <li>
              The video must be <strong>public</strong>. Unlisted or private videos may not be
              accepted — assessors and panel members must be able to view it without requesting
              access. We cannot verify privacy status automatically; you must confirm below.
            </li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Video size={16} /> YouTube Video Link (Poster Presentation){" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-gray-500">
            Upload your 3-minute video to YouTube as a <strong>public</strong> video, then paste
            the link above.
          </p>
          {fieldErrors.video_youtube_url && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.video_youtube_url}</p>
          )}

          <div className="mt-6 space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmsDescription}
                onChange={(e) => setConfirmsDescription(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-royal focus:ring-gold"
              />
              <span>
                I confirm that my <strong>concept note</strong> is used as the YouTube video
                description. <span className="text-red-500">*</span>
              </span>
            </label>
            {fieldErrors.confirms_youtube_description_concept && (
              <p className="text-xs text-red-600">{fieldErrors.confirms_youtube_description_concept}</p>
            )}
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmsTitle}
                onChange={(e) => setConfirmsTitle(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-royal focus:ring-gold"
              />
              <span>
                I confirm my video title follows:{" "}
                <strong>Full Name - KSP Application {cohortYear}</strong>.{" "}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {fieldErrors.confirms_youtube_title_format && (
              <p className="text-xs text-red-600">{fieldErrors.confirms_youtube_title_format}</p>
            )}
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmsPublic}
                onChange={(e) => setConfirmsPublic(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-royal focus:ring-gold"
              />
              <span>
                I confirm that my YouTube video is <strong>public</strong>.{" "}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {fieldErrors.confirms_youtube_public && (
              <p className="text-xs text-red-600">{fieldErrors.confirms_youtube_public}</p>
            )}
          </div>

          <div className="mt-8 flex gap-4">
            <Link
              href="/applicant"
              className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
