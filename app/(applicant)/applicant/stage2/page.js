"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Send, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { validateStage2Video, YOUTUBE_REGEX } from "@/lib/application-validation";

const STAGE2_PROMPT =
  "Create a 3-minute video on a community problem, outlining the identified problem, cause, effect, intervention, and expected outcome.";

export default function Stage2Page() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

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

      if (app.status !== "shortlisted_for_stage2") {
        setApplication(app);
        setLoading(false);
        return;
      }

      setApplication(app);
      setVideoUrl(app.video_youtube_url || "");
      setSubmitted(!!app.video_youtube_url && app.status === "stage2_submitted");
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateStage2Video({ video_youtube_url: videoUrl });
    if (Object.keys(errors).length > 0) {
      setError(errors.video_youtube_url || "Invalid video link");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: updateError } = await supabase
      .from("applications")
      .update({
        video_youtube_url: videoUrl.trim(),
        status: "stage2_submitted",
        stage2_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (updateError) {
      setError(updateError.message || "Failed to submit");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
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
        <Link href="/applicant" className="mt-4 inline-block text-sm font-semibold text-royal hover:text-gold">Go to Dashboard</Link>
      </div>
    );
  }

  if (application.status !== "shortlisted_for_stage2" && !submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <Video size={48} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-xl font-bold text-gray-900">Stage 2 Not Yet Available</h2>
        <p className="mt-2 text-sm text-gray-500">
          You will receive access to Stage 2 (Video Submission) once your application has been shortlisted by the selection committee.
        </p>
        <p className="mt-4 text-xs text-gray-400">Current status: {application.status?.replace(/_/g, " ")}</p>
        <Link href="/applicant" className="mt-6 inline-block rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90">Back to Dashboard</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 size={48} className="mx-auto text-green-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Stage 2 Submitted!</h1>
        <p className="mt-2 text-sm text-gray-500">Your video submission has been received. We will be in touch regarding the next steps.</p>
        <Link href="/applicant" className="mt-6 inline-block rounded-lg bg-royal px-6 py-2.5 text-sm font-semibold text-white hover:bg-royal/90">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/applicant" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Stage 2: Video Submission</h1>
        <p className="mt-1 text-sm text-gray-500">Congratulations on being shortlisted! Submit your poster presentation video.</p>

        <div className="mt-6 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <h3 className="font-semibold text-royal">Video Prompt</h3>
          <p className="mt-2 text-sm text-gray-700">{STAGE2_PROMPT}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Video size={16} /> YouTube Video Link (Poster Presentation) <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-gray-400">Upload your 3-minute video to YouTube (unlisted is fine) and paste the link above.</p>

          <div className="mt-8 flex gap-4">
            <Link href="/applicant" className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
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
