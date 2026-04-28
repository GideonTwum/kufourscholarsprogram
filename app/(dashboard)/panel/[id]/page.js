"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  GraduationCap,
  FileText,
  Video,
  ImageIcon,
  Loader2,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { getLeadershipEvidencePaths } from "@/lib/application-validation";

const INTERVIEW_CRITERIA = [
  { key: "appearance_personality", label: "Appearance / Personality", weight: 5 },
  { key: "leadership_qualities", label: "Demonstrated leadership qualities", weight: 30 },
  { key: "writing_skills", label: "Writing Skills", weight: 10 },
  { key: "global_orientation", label: "Global orientation", weight: 5 },
  { key: "inter_personal_skills", label: "Inter-personal skills", weight: 10 },
  { key: "communication_skills", label: "Communication skills", weight: 10 },
  { key: "initiative", label: "Initiative", weight: 10 },
  { key: "integrity", label: "Integrity", weight: 10 },
  { key: "patriotism", label: "Patriotism", weight: 10 },
];

const SCORE_OPTIONS = [
  { value: 1, label: "1 (Low)" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5 (High)" },
];

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
        <Icon size={16} className="text-royal" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

function DocCard({ label, field, application, docUrls, icon: Icon }) {
  const path = application[field] || application[field?.replace("_url", "")];
  const url = docUrls[field] || docUrls[field?.replace("_url", "")];
  const hasFile = !!path;
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <Icon size={20} className="mb-2 text-gray-400" />
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {!hasFile ? (
        <p className="mt-1 text-xs text-gray-400">Not uploaded</p>
      ) : url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-royal hover:text-gold">
          <ExternalLink size={12} /> View Document
        </a>
      ) : (
        <p className="mt-1 text-xs text-amber-600">Loading…</p>
      )}
    </div>
  );
}

export default function PanelApplicantDetailPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [application, setApplication] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState(null);
  const [scores, setScores] = useState({});
  const [evalNotes, setEvalNotes] = useState("");
  const [savingEval, setSavingEval] = useState(false);
  const [activeTab, setActiveTab] = useState("scoring");
  const [docUrls, setDocUrls] = useState({});

  const docFields = [
    { label: "CV / Personal Statement", field: "cv_personal_statement_url" },
    { label: "Academic transcript", field: "academic_transcript_url" },
    { label: "Recommendation letter", field: "recommendation_url" },
  ];

  useEffect(() => {
    async function load() {
      const { data: app } = await supabase
        .from("applications")
        .select("*, profiles(full_name, email)")
        .eq("id", id)
        .eq("status", "called_for_interview")
        .single();

      if (!app) {
        setLoading(false);
        return;
      }

      setApplication(app);
      setProfile(app.profiles);

      const { data: { user } } = await supabase.auth.getUser();
      const { data: evalRow } = await supabase
        .from("interview_evaluations")
        .select("*")
        .eq("application_id", id)
        .eq("evaluator_id", user?.id)
        .maybeSingle();

      if (evalRow) {
        setEvaluation(evalRow);
        const s = {};
        INTERVIEW_CRITERIA.forEach((c) => {
          s[c.key] = evalRow[c.key] ?? null;
        });
        setScores(s);
        setEvalNotes(evalRow.notes || "");
      } else {
        const s = {};
        INTERVIEW_CRITERIA.forEach((c) => { s[c.key] = null; });
        setScores(s);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!application) return;
    const fetchUrls = async () => {
      const urls = {};
      const pdfFields = {
        cv_personal_statement_url: application.cv_personal_statement_url || application.cv_url,
        academic_transcript_url: application.academic_transcript_url,
        recommendation_url: application.recommendation_url,
      };
      for (const [field, path] of Object.entries(pdfFields)) {
        if (!path) continue;
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          if (data.url) urls[field] = data.url;
        } catch (_) {}
      }
      const photo = application.photo_url;
      if (photo) {
        if (/^https?:\/\//i.test(photo)) urls.photo_url = photo;
        else {
          try {
            const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(photo)}`);
            const data = await res.json();
            if (data.url) urls.photo_url = data.url;
          } catch (_) {}
        }
      }
      const leads = getLeadershipEvidencePaths(application);
      urls.leadership = [];
      for (const path of leads) {
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          urls.leadership.push(data.url || null);
        } catch (_) {
          urls.leadership.push(null);
        }
      }
      setDocUrls(urls);
    };
    fetchUrls();
  }, [
    application?.id,
    application?.cv_personal_statement_url,
    application?.cv_url,
    application?.academic_transcript_url,
    application?.leadership_evidence_url,
    application?.leadership_evidence_urls,
    application?.recommendation_url,
    application?.photo_url,
  ]);

  const weightedTotal = INTERVIEW_CRITERIA.reduce((sum, c) => {
    const s = scores[c.key];
    if (s == null) return sum;
    return sum + (s / 5) * c.weight;
  }, 0);

  async function saveEvaluation() {
    setSavingEval(true);
    const { data: user } = (await supabase.auth.getUser()).data;
    const payload = {
      application_id: id,
      evaluator_id: user?.id,
      notes: evalNotes,
      total_weighted_score: Math.round(weightedTotal * 100) / 100,
      updated_at: new Date().toISOString(),
    };
    INTERVIEW_CRITERIA.forEach((c) => {
      const v = scores[c.key];
      if (v != null) payload[c.key] = v;
    });

    if (evaluation?.id) {
      const { data: updated } = await supabase.from("interview_evaluations").update(payload).eq("id", evaluation.id).select().single();
      if (updated) setEvaluation(updated);
    } else {
      const { data: inserted } = await supabase.from("interview_evaluations").insert(payload).select().single();
      if (inserted) setEvaluation(inserted);
    }
    setSavingEval(false);
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
      <div className="text-center">
        <p className="text-gray-500">Applicant not found or not scheduled for interview.</p>
        <Link href="/panel" className="mt-2 inline-block text-sm text-royal">Back to Interview Applicants</Link>
      </div>
    );
  }

  const appWithCv = { ...application, cv_personal_statement_url: application.cv_personal_statement_url || application.cv_url };

  return (
    <div>
      <div className="mb-8">
        <Link href="/panel" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
          <ArrowLeft size={14} /> Back to Interview Applicants
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-royal text-lg font-bold text-gold">
            {profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {application.full_name || profile?.full_name || "Unknown"}
            </h1>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("details")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "details" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Applicant Details
        </button>
        <button
          onClick={() => setActiveTab("scoring")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "scoring" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Interview Scoring
        </button>
      </div>

      {/* Details tab */}
      {activeTab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Personal Information" icon={User}>
            <dl className="grid grid-cols-2 gap-x-6">
              <Field label="Full Name" value={application.full_name} />
              <Field label="Date of Birth" value={application.date_of_birth} />
              <Field label="Phone" value={application.phone} />
              <Field label="Nationality" value={application.nationality} />
              <Field label="Address" value={application.address} />
              <Field label="Hometown & Region" value={[application.hometown, application.region].filter(Boolean).join(", ")} />
              <Field label="Country of Origin" value={application.country_of_origin} />
              <Field label="University" value={application.university} />
              <Field label="Program" value={application.program} />
              <Field label="Year of Study" value={application.year_of_study} />
              <Field label="Grade type" value={application.grade_type} />
              <Field label="Grade (CWA/CGPA/GPA)" value={application.gpa} />
            </dl>
          </Section>

          <Section title="Stage 1 Documents" icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-2">
              {application.photo_url && (
                <DocCard label="Passport / profile photo" field="photo_url" application={application} docUrls={docUrls} icon={ImageIcon} />
              )}
              {docFields.map((doc) => (
                <DocCard key={doc.field} label={doc.label} field={doc.field} application={appWithCv} docUrls={docUrls} icon={FileText} />
              ))}
              {getLeadershipEvidencePaths(application).map((path, i) => (
                <div key={`lead-${i}`} className="rounded-lg border border-gray-100 p-4">
                  <FileText size={20} className="mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">Leadership evidence {i + 1}</p>
                  {!path ? (
                    <p className="mt-1 text-xs text-gray-400">Not uploaded</p>
                  ) : docUrls.leadership?.[i] ? (
                    <a href={docUrls.leadership[i]} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-royal hover:text-gold">
                      <ExternalLink size={12} /> View Document
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-amber-600">Loading…</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <div className="lg:col-span-2">
            <Section title="Stage 2 Video (Poster Presentation)" icon={Video}>
              {application.video_youtube_url ? (
                <a href={application.video_youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-royal/5 px-4 py-3 text-sm font-medium text-royal hover:bg-royal/10">
                  <ExternalLink size={14} /> Watch Video
                </a>
              ) : (
                <p className="text-sm text-gray-400">No video provided.</p>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* Scoring tab */}
      {activeTab === "scoring" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
            <ClipboardList size={16} className="text-royal" />
            Face-to-Face Interview Scoring
          </h3>
          <p className="mb-6 text-xs text-gray-500">
            Score each criterion from 1 (Low) to 5 (High). The weighted total is calculated automatically.
          </p>

          <div className="space-y-4">
            {INTERVIEW_CRITERIA.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 p-4">
                <div className="min-w-[200px] flex-1">
                  <span className="text-sm font-medium text-gray-900">{c.label}</span>
                  <span className="ml-1 text-xs text-gray-500">({c.weight}%)</span>
                </div>
                <select
                  value={scores[c.key] ?? ""}
                  onChange={(e) => setScores((prev) => ({ ...prev, [c.key]: e.target.value ? +e.target.value : null }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">—</option>
                  {SCORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-royal/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Total Weighted Score</span>
              <span className="text-xl font-bold text-royal">{weightedTotal.toFixed(2)}%</span>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Notes</label>
            <textarea
              value={evalNotes}
              onChange={(e) => setEvalNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes on the interview..."
              className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <button
            onClick={saveEvaluation}
            disabled={savingEval}
            className="mt-6 flex items-center gap-2 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold/90 disabled:opacity-50"
          >
            {savingEval ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Save Evaluation
          </button>
        </div>
      )}
    </div>
  );
}
