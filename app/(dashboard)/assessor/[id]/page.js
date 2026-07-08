"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  User,
  Video,
} from "lucide-react";
import { getLeadershipEvidencePaths } from "@/lib/application-validation";
import { assessmentStageForStatus } from "@/lib/assessor-workflow";

const scoreFields = [
  { key: "academic_score", label: "Academic strength" },
  { key: "leadership_score", label: "Leadership evidence" },
  { key: "service_score", label: "Service / community impact" },
  { key: "communication_score", label: "Communication quality" },
];

function nameFor(app) {
  return app?.full_name || app?.profiles?.full_name || app?.profiles?.email || "Applicant";
}

function Field({ label, value }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
        <Icon size={16} className="text-royal" /> {title}
      </h2>
      {children}
    </section>
  );
}

function DocumentLink({ label, url, loading }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <FileText size={20} className="mb-2 text-gray-400" />
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-royal hover:text-gold"
        >
          <ExternalLink size={12} /> View document
        </a>
      ) : (
        <p className="mt-1 text-xs text-gray-400">{loading ? "Loading…" : "Not uploaded"}</p>
      )}
    </div>
  );
}

export default function AssessorApplicantDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [application, setApplication] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [docUrls, setDocUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ error: "", success: "" });
  const [scores, setScores] = useState({
    academic_score: "",
    leadership_score: "",
    service_score: "",
    communication_score: "",
  });
  const [recommendation, setRecommendation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/assessor/applications/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ success: "", error: data.error || "Failed to load applicant." });
      } else {
        setApplication(data.application);
        setAssessments(data.assessments || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const stage = useMemo(
    () => (application ? assessmentStageForStatus(application.status) : "stage_1"),
    [application],
  );

  useEffect(() => {
    const current = assessments.find((row) => row.stage === stage);
    if (!current) return;
    setScores({
      academic_score: current.academic_score || "",
      leadership_score: current.leadership_score || "",
      service_score: current.service_score || "",
      communication_score: current.communication_score || "",
    });
    setRecommendation(current.recommendation || "");
    setNotes(current.notes || "");
  }, [assessments, stage]);

  useEffect(() => {
    if (!application) return;
    async function loadDocs() {
      const fields = {
        cv: application.cv_personal_statement_url || application.cv_url,
        transcript: application.academic_transcript_url,
        recommendation: application.recommendation_url,
        photo: application.photo_url,
      };
      const next = {};
      for (const [key, path] of Object.entries(fields)) {
        if (!path) continue;
        if (/^https?:\/\//i.test(path)) {
          next[key] = path;
          continue;
        }
        const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (data.url) next[key] = data.url;
      }

      const leadership = [];
      for (const path of getLeadershipEvidencePaths(application)) {
        const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        leadership.push(data.url || null);
      }
      next.leadership = leadership;
      setDocUrls(next);
    }
    loadDocs();
  }, [application]);

  const overall = useMemo(() => {
    const values = Object.values(scores).map(Number).filter((n) => Number.isFinite(n));
    if (values.length !== 4) return null;
    return values.reduce((sum, value) => sum + value, 0) / 4;
  }, [scores]);

  async function submitAssessment(e) {
    e.preventDefault();
    setSaving(true);
    setMessage({ error: "", success: "" });
    const res = await fetch(`/api/assessor/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scores, recommendation, notes }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Could not save assessment." });
      return;
    }
    setMessage({ error: "", success: `Saved. Application moved to ${data.status.replace(/_/g, " ")}.` });
    setTimeout(() => router.push("/assessor"), 900);
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center">
        <p className="font-medium text-gray-900">Applicant unavailable</p>
        <p className="mt-2 text-sm text-gray-500">{message.error || "You may not be assigned to this applicant."}</p>
        <Link href="/assessor" className="mt-4 inline-block text-sm text-royal">
          Back to assigned applicants
        </Link>
      </div>
    );
  }

  const recommendationOptions =
    stage === "stage_1"
      ? [
          { value: "advance", label: "Advance to Stage 2" },
          { value: "hold", label: "Hold / defer Stage 1" },
          { value: "reject", label: "Reject" },
        ]
      : [
          { value: "recommend_interview", label: "Recommend for interview" },
          { value: "hold", label: "Hold / defer Stage 2" },
          { value: "reject", label: "Reject" },
        ];

  return (
    <div>
      <Link href="/assessor" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
        <ArrowLeft size={14} /> Back to assigned applicants
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{nameFor(application)}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {application.profiles?.email || "No email"} · {application.status?.replace(/_/g, " ")}
        </p>
      </div>

      {message.error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {message.error}
        </div>
      )}
      {message.success && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> {message.success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Section title="Applicant details" icon={User}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Field label="Full name" value={nameFor(application)} />
              <Field label="Phone" value={application.phone} />
              <Field label="Nationality" value={application.nationality} />
              <Field label="University" value={application.university} />
              <Field label="Program" value={application.program} />
              <Field label="Year of study" value={application.year_of_study} />
              <Field label="Grade type" value={application.grade_type} />
              <Field label="Grade" value={application.gpa} />
            </dl>
          </Section>

          <Section title="Documents" icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DocumentLink label="CV / Personal Statement" url={docUrls.cv} loading={!!(application.cv_personal_statement_url || application.cv_url)} />
              <DocumentLink label="Academic Transcript" url={docUrls.transcript} loading={!!application.academic_transcript_url} />
              <DocumentLink label="Recommendation Letter" url={docUrls.recommendation} loading={!!application.recommendation_url} />
              {getLeadershipEvidencePaths(application).map((_, i) => (
                <DocumentLink key={i} label={`Leadership evidence ${i + 1}`} url={docUrls.leadership?.[i]} loading />
              ))}
            </div>
          </Section>

          <Section title="Stage 2 video" icon={Video}>
            {application.video_youtube_url ? (
              <a href={application.video_youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-royal">
                <ExternalLink size={14} /> Watch video
              </a>
            ) : (
              <p className="text-sm text-gray-500">No Stage 2 video submitted yet.</p>
            )}
          </Section>
        </div>

        <form onSubmit={submitAssessment} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <GraduationCap size={18} /> {stage === "stage_1" ? "Stage 1" : "Stage 2"} assessment
          </h2>
          <p className="mt-1 text-sm text-gray-500">Score each category from 1 to 5.</p>

          <div className="mt-6 space-y-4">
            {scoreFields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-gray-500">{field.label}</label>
                <select
                  value={scores[field.key]}
                  onChange={(e) => setScores((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select score</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-royal/5 p-4">
            <p className="text-xs font-medium text-gray-500">Average score</p>
            <p className="mt-1 text-2xl font-bold text-royal">{overall == null ? "—" : overall.toFixed(2)}</p>
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Recommendation</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            >
              <option value="">Select recommendation</option>
              {recommendationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm"
              placeholder="Assessment notes for the director..."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-royal disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Save assessment
          </button>
        </form>
      </div>
    </div>
  );
}
