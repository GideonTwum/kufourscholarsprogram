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
  CheckCircle2,
  XCircle,
  Users,
  Loader2,
  ExternalLink,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { getLeadershipEvidencePaths } from "@/lib/application-validation";

const statusFlow = [
  { key: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  { key: "pending", label: "Pending", color: "bg-amber-100 text-amber-700" },
  { key: "shortlisted_for_stage2", label: "Shortlisted (Stage 2)", color: "bg-purple-100 text-purple-700" },
  { key: "stage2_submitted", label: "Stage 2 Submitted", color: "bg-indigo-100 text-indigo-700" },
  { key: "interview", label: "Interview", color: "bg-indigo-100 text-indigo-700" },
  { key: "accepted", label: "Accepted", color: "bg-green-100 text-green-700" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

const workflowTimeline = [
  { key: "pending", label: "Pending" },
  { key: "shortlisted_for_stage2", label: "Shortlisted (Stage 2)" },
  { key: "stage2_submitted", label: "Stage 2 Submitted" },
  { key: "interview", label: "Interview" },
];

function workflowProgressIndex(status) {
  if (status === "accepted" || status === "rejected") return workflowTimeline.length + 1;
  const i = workflowTimeline.findIndex((t) => t.key === status);
  return i >= 0 ? i : 0;
}

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

const cohortOptions = [
  "Class of 2026",
  "Class of 2027",
  "Class of 2028",
  "Class of 2029",
  "Class of 2030",
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
  const path = application[field] || application[field.replace("_url", "")];
  const url = docUrls[field] || docUrls[field.replace("_url", "")];
  const hasFile = !!path;
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <Icon size={20} className="mb-2 text-gray-400" />
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {!hasFile ? (
        <p className="mt-1 text-xs text-gray-400">Not uploaded</p>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-royal hover:text-gold"
        >
          <ExternalLink size={12} />
          View Document
        </a>
      ) : (
        <p className="mt-1 text-xs text-amber-600">Loading…</p>
      )}
    </div>
  );
}

export default function ApplicationReviewPage() {
  const { id } = useParams();
  const supabase = createClient();

  const [application, setApplication] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedClass, setSelectedClass] = useState("Class of 2029");
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [activeTab, setActiveTab] = useState("stage1");
  const [evaluation, setEvaluation] = useState(null);
  const [scores, setScores] = useState({});
  const [evalNotes, setEvalNotes] = useState("");
  const [savingEval, setSavingEval] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: app } = await supabase
        .from("applications")
        .select("*, profiles(full_name, email, class_name, role)")
        .eq("id", id)
        .single();

      if (app) {
        setApplication(app);
        setProfile(app.profiles);
        setNotes(app.director_notes || "");
      }

      const { data: evalRow } = await supabase
        .from("interview_evaluations")
        .select("*")
        .eq("application_id", id)
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

  async function updateStatus(newStatus, extra = {}) {
    setUpdating(true);
    const body = { status: newStatus, director_notes: notes };
    if (newStatus === "accepted") {
      body.class_name = selectedClass;
    }
    if (newStatus === "rejected" && extra.rejection_reason) {
      body.rejection_reason = extra.rejection_reason;
    }

    const res = await fetch(`/api/applications/${id}/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setApplication((prev) => ({
        ...prev,
        status: newStatus,
        director_notes: notes,
        ...(newStatus === "rejected" && extra.rejection_reason
          ? { rejection_reason: extra.rejection_reason }
          : {}),
      }));
      if (newStatus === "accepted") {
        setProfile((prev) => ({ ...prev, role: "scholar", class_name: selectedClass }));
      }
      setShowAcceptModal(false);
      setShowRejectModal(false);
      setRejectReasonDraft("");
    }
    setUpdating(false);
  }

  const docFields = [
    { label: "CV / Personal Statement", field: "cv_personal_statement_url" },
    { label: "Academic transcript", field: "academic_transcript_url" },
    { label: "Recommendation letter", field: "recommendation_url" },
  ];

  // Fallback to legacy cv_url if cv_personal_statement_url is empty
  const effectiveDocPaths = {
    cv_personal_statement_url: application?.cv_personal_statement_url || application?.cv_url,
    academic_transcript_url: application?.academic_transcript_url,
    recommendation_url: application?.recommendation_url,
  };

  const [docUrls, setDocUrls] = useState({});

  useEffect(() => {
    if (!application) return;
    const fetchSignedUrls = async () => {
      const urls = {};
      for (const [field, path] of Object.entries(effectiveDocPaths)) {
        if (!path) continue;
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          if (data.url) urls[field] = data.url;
        } catch (_) {}
      }
      const photo = application.photo_url;
      if (photo) {
        if (/^https?:\/\//i.test(photo)) {
          urls.photo_url = photo;
        } else {
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
    fetchSignedUrls();
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

  const weightedTotal =
    INTERVIEW_CRITERIA.reduce((sum, c) => {
      const s = scores[c.key];
      if (s == null) return sum;
      return sum + ((s / 5) * c.weight);
    }, 0);

  async function saveEvaluation() {
    setSavingEval(true);
    const payload = {
      application_id: id,
      notes: evalNotes,
      total_weighted_score: Math.round(weightedTotal * 100) / 100,
      updated_at: new Date().toISOString(),
    };
    INTERVIEW_CRITERIA.forEach((c) => {
      const v = scores[c.key];
      if (v != null) payload[c.key] = v;
    });

    const { data: user } = (await supabase.auth.getUser()).data;
    if (user) payload.evaluator_id = user.id;

    if (evaluation?.id) {
      const { error } = await supabase.from("interview_evaluations").update(payload).eq("id", evaluation.id);
      if (!error) setEvaluation((prev) => ({ ...prev, ...payload }));
    } else {
      const { data: inserted, error } = await supabase.from("interview_evaluations").insert(payload).select().single();
      if (!error) setEvaluation(inserted);
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
        <p className="text-gray-500">Application not found.</p>
        <Link href="/director/applications" className="mt-2 text-sm text-royal">
          Back to Applications
        </Link>
      </div>
    );
  }

  const currentStatusIndex = workflowProgressIndex(application.status);
  const isTerminal = application.status === "accepted" || application.status === "rejected";

  return (
    <div>
      <div className="mb-8">
        <Link href="/director/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
          <ArrowLeft size={14} />
          Back to Applications
        </Link>
        <div className="flex items-start justify-between">
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
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFlow.find((s) => s.key === application.status)?.color || "bg-gray-100 text-gray-600"}`}>
            {statusFlow.find((s) => s.key === application.status)?.label || application.status?.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Status progress */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {workflowTimeline.map((step, i) => {
            const completed = i < currentStatusIndex;
            const active = application.status === step.key;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${completed ? "bg-royal text-white" : active ? "bg-gold text-royal ring-4 ring-gold/20" : "bg-gray-100 text-gray-400"}`}>
                    {completed ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span className="mt-1 text-[10px] font-medium text-gray-500 max-w-[80px] text-center">{step.label}</span>
                </div>
                {i < workflowTimeline.length - 1 && (
                  <div className={`mx-1 h-0.5 w-4 ${completed ? "bg-royal" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        {application.status === "accepted" && profile?.class_name && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-center text-sm font-semibold text-green-700">
            Accepted into {profile.class_name}
          </div>
        )}
        {application.status === "rejected" && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Application Rejected</p>
            {application.rejection_reason ? (
              <p className="mt-2 text-left text-red-900">{application.rejection_reason}</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("stage1")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "stage1" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stage 1 Details
        </button>
        <button
          onClick={() => setActiveTab("stage2")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "stage2" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stage 2 Details
        </button>
        {(application.status === "interview" || evaluation) && (
          <button
            onClick={() => setActiveTab("interview")}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "interview" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Interview Scoring
          </button>
        )}
      </div>

      {/* Stage 1 Tab */}
      {activeTab === "stage1" && (
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
              <Field
                label="Emergency contact 1"
                value={
                  application.emergency_contact_name
                    ? `${application.emergency_contact_name} — ${application.emergency_contact_number || ""}`
                    : null
                }
              />
              <Field
                label="Emergency contact 2"
                value={
                  application.emergency_contact_2_name
                    ? `${application.emergency_contact_2_name} — ${application.emergency_contact_2_number || ""}`
                    : null
                }
              />
              <Field label="LinkedIn" value={application.linkedin_url} />
              <Field label="Instagram" value={application.instagram_url} />
              <Field label="Facebook" value={application.facebook_url} />
              <Field label="TikTok" value={application.tiktok_url} />
              <Field label="Snapchat" value={application.snapchat_url} />
              <Field label="X (Twitter)" value={application.twitter_url} />
            </dl>
          </Section>

          <Section title="Academic Information" icon={GraduationCap}>
            <dl className="grid grid-cols-2 gap-x-6">
              <Field label="University" value={application.university} />
              <Field label="Program" value={application.program} />
              <Field label="Year of Study" value={application.year_of_study} />
              <Field label="Grade type (CWA / CGPA / GPA)" value={application.grade_type} />
              <Field label="Grade value" value={application.gpa} />
              <Field label="Junior High School" value={application.junior_high_school} />
              <Field label="Senior High School" value={application.senior_high_school} />
              <Field label="Student ID Number" value={application.student_id} />
            </dl>
          </Section>

          <div className="lg:col-span-2">
            <Section title="Stage 1 Documents" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {application.photo_url && (
                  <DocCard
                    key="photo"
                    label="Passport / profile photo"
                    field="photo_url"
                    application={application}
                    docUrls={docUrls}
                    icon={ImageIcon}
                  />
                )}
                {docFields.map((doc) => (
                  <DocCard
                    key={doc.field}
                    label={doc.label}
                    field={doc.field}
                    application={{ ...application, cv_personal_statement_url: application.cv_personal_statement_url || application.cv_url }}
                    docUrls={docUrls}
                    icon={FileText}
                  />
                ))}
                {getLeadershipEvidencePaths(application).map((path, i) => (
                  <div key={`lead-${i}-${path}`} className="rounded-lg border border-gray-100 p-4">
                    <FileText size={20} className="mb-2 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">Leadership evidence {i + 1}</p>
                    {!path ? (
                      <p className="mt-1 text-xs text-gray-400">Not uploaded</p>
                    ) : docUrls.leadership?.[i] ? (
                      <a
                        href={docUrls.leadership[i]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-royal hover:text-gold"
                      >
                        <ExternalLink size={12} />
                        View Document
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-amber-600">Loading…</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* Stage 2 Tab */}
      {activeTab === "stage2" && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Video size={16} className="text-royal" />
            YouTube Video (Poster Presentation)
          </h3>
          {application.video_youtube_url ? (
            <a
              href={application.video_youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-royal/5 px-4 py-3 text-sm font-medium text-royal hover:bg-royal/10"
            >
              <ExternalLink size={14} />
              Watch Video
            </a>
          ) : (
            <p className="text-sm text-gray-400">
              {["shortlisted_for_stage2", "pending"].includes(
                application.status
              )
                ? "Applicant has not yet submitted Stage 2 video."
                : "No video provided."}
            </p>
          )}
          {application.stage2_submitted_at && (
            <p className="mt-2 text-xs text-gray-500">
              Submitted: {new Date(application.stage2_submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Interview Scoring Tab */}
      {activeTab === "interview" && (
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
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveEvaluation}
              disabled={savingEval}
              className="flex items-center gap-2 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold/90 disabled:opacity-50"
            >
              {savingEval ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Save Evaluation
            </button>
            {application.status === "interview" && (
              <>
                <button
                  onClick={() => setShowAcceptModal(true)}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </>
            )}
            {updating && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>
        </div>
      )}

      {/* Director actions */}
      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-gray-900">Director Actions</h3>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Internal Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this applicant (only visible to directors)..."
            className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>

        {!isTerminal && (
          <div className="flex flex-wrap gap-3">
            {application.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => updateStatus("shortlisted_for_stage2")}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  <Users size={14} />
                  Shortlisted (Stage 2)
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Rejected
                </button>
              </>
            )}
            {application.status === "shortlisted_for_stage2" && (
              <p className="text-sm text-gray-500">Waiting for applicant to submit Stage 2 video.</p>
            )}
            {application.status === "stage2_submitted" && (
              <button
                onClick={() => updateStatus("interview")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                <Video size={14} />
                Move to Interview
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Reject application</h3>
            <p className="mt-1 text-sm text-gray-500">
              Provide a reason for the applicant (shown in their portal).
            </p>
            <textarea
              value={rejectReasonDraft}
              onChange={(e) => setRejectReasonDraft(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              placeholder="Rejection reason"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReasonDraft("");
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating || !rejectReasonDraft.trim()}
                onClick={() => updateStatus("rejected", { rejection_reason: rejectReasonDraft.trim() })}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? "Saving…" : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Accept Applicant</h3>
            <p className="mt-1 text-sm text-gray-500">Assign this applicant to a cohort. They will become a Scholar upon acceptance.</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Assign to Cohort</label>
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {cohortOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAcceptModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => updateStatus("accepted")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirm Acceptance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
