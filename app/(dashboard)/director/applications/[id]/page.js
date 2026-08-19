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
  Clock,
} from "lucide-react";
import { getLeadershipEvidencePaths } from "@/lib/application-validation";
import { getDirectorStageActions } from "@/lib/director-stage-actions";
import { evaluatorDisplayName } from "@/lib/staff-lifecycle";
import DirectorStageActionBar from "../../components/DirectorStageActionBar";
import DirectorAssessorAssignmentPanel from "@/components/director/DirectorAssessorAssignmentPanel";

const statusFlow = [
  { key: "draft", label: "Draft", color: "bg-gray-100 text-gray-600" },
  { key: "stage_1_submitted", label: "Stage 1 submitted", color: "bg-amber-100 text-amber-700" },
  { key: "review_pending", label: "Deferred (Stage 1)", color: "bg-slate-100 text-slate-700" },
  { key: "stage_1_approved", label: "Stage 1 approved", color: "bg-purple-100 text-purple-700" },
  { key: "stage_2_submitted", label: "Stage 2 submitted", color: "bg-indigo-100 text-indigo-700" },
  { key: "stage_2_review_pending", label: "Deferred (Stage 2)", color: "bg-slate-100 text-slate-700" },
  { key: "stage_2_approved", label: "Stage 2 approved", color: "bg-indigo-100 text-indigo-700" },
  { key: "interview_review_pending", label: "Interview pending", color: "bg-slate-100 text-slate-700" },
  { key: "called_for_interview", label: "Called for interview", color: "bg-indigo-100 text-indigo-700" },
  { key: "accepted", label: "Accepted", color: "bg-green-100 text-green-700" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

const workflowTimeline = [
  { key: "stage_1_submitted", label: "Stage 1 review" },
  { key: "stage_1_approved", label: "Stage 1 ✓" },
  { key: "stage_2_submitted", label: "Stage 2 submitted" },
  { key: "stage_2_approved", label: "Stage 2 ✓" },
  { key: "called_for_interview", label: "Interview" },
];

function workflowProgressIndex(status) {
  if (status === "accepted" || status === "rejected") return workflowTimeline.length + 1;
  if (status === "draft") return -1;
  if (status === "review_pending") {
    return workflowTimeline.findIndex((t) => t.key === "stage_1_submitted");
  }
  if (status === "stage_2_review_pending") {
    return workflowTimeline.findIndex((t) => t.key === "stage_2_submitted");
  }
  if (status === "interview_review_pending") {
    return workflowTimeline.findIndex((t) => t.key === "stage_2_approved");
  }
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
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900">
        <Icon size={16} className="shrink-0 text-royal" />
        <span className="min-w-0 break-words">{title}</span>
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

function DocCard({ label, field, application, docUrls, icon: Icon }) {
  const path = application[field] || application[field.replace("_url", "")];
  const url = docUrls[field] || docUrls[field.replace("_url", "")];
  const hasFile = !!path;
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 p-4">
      <Icon size={20} className="mb-2 text-gray-400" />
      <p className="truncate text-sm font-medium text-gray-900" title={label}>{label}</p>
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
  const [showViewInterviewModal, setShowViewInterviewModal] = useState(false);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [activeTab, setActiveTab] = useState("stage1");
  const [evaluation, setEvaluation] = useState(null);
  const [panelEvalHistory, setPanelEvalHistory] = useState([]);
  const [assessorReviews, setAssessorReviews] = useState([]);
  const [scores, setScores] = useState({});
  const [evalNotes, setEvalNotes] = useState("");
  const [savingEval, setSavingEval] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewDraft, setInterviewDraft] = useState({
    interview_date: "",
    interview_time: "",
    interview_location: "",
    interview_instructions: "",
  });

  useEffect(() => {
    async function load() {
      let app = null;

      const { data: directApp } = await supabase
        .from("applications")
        .select(
          "*, profiles!applications_user_id_fkey(full_name, email, class_name, role)"
        )
        .eq("id", id)
        .single();

      if (directApp) {
        app = directApp;
      } else {
        try {
          const res = await fetch(`/api/director/applications/${id}`);
          if (res.ok) {
            const json = await res.json();
            app = json.application;
          }
        } catch (_) {}
      }

      if (app) {
        setApplication(app);
        setProfile(app.profiles);
        setNotes(app.director_notes || "");
      }

      const {
        data: { user: me },
      } = await supabase.auth.getUser();

      const { data: evalRows } = await supabase
        .from("interview_evaluations")
        .select("*")
        .eq("application_id", id)
        .order("updated_at", { ascending: false });

      const rows = evalRows || [];
      setPanelEvalHistory(rows);

      const { data: assessorRows } = await supabase
        .from("application_assessments")
        .select(
          "id, stage, academic_score, leadership_score, service_score, communication_score, overall_score, recommendation, notes, submitted_at, assessor_name_snapshot, assessor_email_snapshot, assessor_id"
        )
        .eq("application_id", id)
        .order("submitted_at", { ascending: false });

      setAssessorReviews(assessorRows || []);

      const evalRow =
        rows.find((r) => r.evaluator_id === me?.id) ||
        rows.find((r) => !r.evaluator_id) ||
        null;

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
    if (newStatus === "called_for_interview") {
      body.interview =
        extra.interview ||
        (interviewDraft.interview_date && interviewDraft.interview_time && interviewDraft.interview_location
          ? interviewDraft
          : null);
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
        ...(newStatus === "called_for_interview" && body.interview
          ? {
              interview_date: body.interview.interview_date,
              interview_time: body.interview.interview_time,
              interview_location: body.interview.interview_location,
              interview_instructions: body.interview.interview_instructions,
            }
          : {}),
      }));
      if (newStatus === "accepted") {
        setProfile((prev) => ({ ...prev, role: "scholar", class_name: selectedClass }));
      }
      if (newStatus === "called_for_interview") {
        setShowInterviewModal(false);
        setActionMessage("Interview scheduled successfully.");
      } else if (newStatus === "interview_review_pending" && application.status === "stage_2_approved") {
        setActionMessage("Applicant added to the interview queue.");
      } else if (newStatus === "stage_2_approved" && application.status === "interview_review_pending") {
        setActionMessage("Applicant removed from the interview queue.");
      } else if (newStatus === "interview") {
        setActionMessage("Interview marked complete. Final programme review is now available.");
      } else {
        setActionMessage("");
      }
      setShowAcceptModal(false);
      setShowRejectModal(false);
      setRejectReasonDraft("");
    } else {
      try {
        const err = await res.json();
        setActionMessage(err.error || "Status update failed.");
      } catch {
        setActionMessage("Status update failed.");
      }
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
    concept_note_path: application?.concept_note_path,
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
    application?.concept_note_path,
    application?.concept_note_title,
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
  const hasInterviewDetails = Boolean(
    application.interview_date && application.interview_time && application.interview_location
  );
  const stageActions = getDirectorStageActions(application.status, { hasInterviewDetails });

  function openInterviewModal({ reschedule = false } = {}) {
    if (reschedule || hasInterviewDetails) {
      setInterviewDraft({
        interview_date: application.interview_date || "",
        interview_time: application.interview_time || "",
        interview_location: application.interview_location || "",
        interview_instructions: application.interview_instructions || "",
      });
    }
    setShowViewInterviewModal(false);
    setShowInterviewModal(true);
  }

  function handleStageAction(action) {
    if (!action || action.type === "disabled") return;
    if (action.type === "noop") {
      setActionMessage("Application kept pending at Stage 2 approved — not yet shortlisted for interview.");
      return;
    }
    if (action.type === "status" && action.next) {
      updateStatus(action.next);
      return;
    }
    if (action.type === "interview_modal") {
      openInterviewModal({
        reschedule: application.status === "called_for_interview" || application.status === "interview",
      });
      return;
    }
    if (action.type === "view_interview") {
      setShowViewInterviewModal(true);
      return;
    }
    if (action.type === "accept_modal") {
      setShowAcceptModal(true);
      return;
    }
    if (action.type === "reject") {
      setShowRejectModal(true);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/director/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal">
          <ArrowLeft size={14} />
          Back to Applications
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-royal text-lg font-bold text-gold">
              {profile?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900">
                {application.full_name || profile?.full_name || "Unknown"}
              </h1>
              <p className="truncate text-sm text-gray-500">{profile?.email}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusFlow.find((s) => s.key === application.status)?.color || "bg-gray-100 text-gray-600"}`}>
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
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("stage1")}
          className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "stage1" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stage 1 Details
        </button>
        <button
          onClick={() => setActiveTab("stage2")}
          className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "stage2" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Stage 2 Details
        </button>
        {(application.status === "called_for_interview" || evaluation) && (
          <button
            type="button"
            onClick={() => setActiveTab("interview")}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "interview" ? "border-royal text-royal" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Interview Scoring
          </button>
        )}
      </div>

      {/* Stage 1 Tab */}
      {activeTab === "stage1" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Personal Information" icon={User}>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Field label="Full Name" value={application.full_name} />
              <Field label="Date of Birth" value={application.date_of_birth} />
              <Field label="Phone" value={application.phone} />
              <Field label="Nationality" value={application.nationality} />
              <Field label="Address" value={application.address} />
              <Field label="Hometown & Region" value={[application.hometown, application.region].filter(Boolean).join(", ")} />
              <Field label="Country of Origin" value={application.country_of_origin} />
              <Field
                label="Dual citizenship"
                value={
                  application.has_dual_citizenship === true
                    ? "Yes"
                    : application.has_dual_citizenship === false
                      ? "No"
                      : null
                }
              />
              {application.has_dual_citizenship ? (
                <Field
                  label="Second Country of Citizenship"
                  value={application.second_citizenship_country}
                />
              ) : null}
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
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  <div key={`lead-${i}-${path}`} className="min-w-0 rounded-lg border border-gray-100 p-4">
                    <FileText size={20} className="mb-2 text-gray-400" />
                    <p className="truncate text-sm font-medium text-gray-900">Leadership evidence {i + 1}</p>
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

          <div className="lg:col-span-2">
            <Section title="Concept Note" icon={FileText}>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {application.concept_note_title?.trim() || "Not provided"}
                  </p>
                </div>
                {application.concept_note_path ? (
                  <DocCard
                    label="Concept Note PDF"
                    field="concept_note_path"
                    application={application}
                    docUrls={docUrls}
                    icon={FileText}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No Concept Note uploaded.</p>
                )}
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
              {["stage_1_approved", "stage_1_submitted"].includes(application.status)
                ? "Applicant has not yet submitted Stage 2 video."
                : "No video provided."}
            </p>
          )}
          {(application.stage_2_submitted_at || application.stage2_submitted_at) && (
            <p className="mt-2 text-xs text-gray-500">
              Submitted:{" "}
              {new Date(
                application.stage_2_submitted_at || application.stage2_submitted_at,
              ).toLocaleString()}
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

          {panelEvalHistory.length > 0 && (
            <div className="mb-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Panel evaluation history
              </p>
              <ul className="space-y-2">
                {panelEvalHistory.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-gray-800"
                  >
                    <span>
                      <span className="font-medium">{evaluatorDisplayName(row)}</span>
                      {row.evaluator_email_snapshot ? (
                        <span className="ml-2 text-xs text-gray-500">{row.evaluator_email_snapshot}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-600">
                      {row.total_weighted_score != null
                        ? `${Number(row.total_weighted_score).toFixed(2)}%`
                        : "—"}
                      {row.updated_at
                        ? ` · ${new Date(row.updated_at).toLocaleString()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {panelEvalHistory.some((r) => r.notes) && (
                <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                  {panelEvalHistory
                    .filter((r) => r.notes)
                    .map((r) => (
                      <p key={`notes-${r.id}`} className="text-xs text-gray-600">
                        <span className="font-medium text-gray-800">{evaluatorDisplayName(r)}:</span>{" "}
                        {r.notes}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {INTERVIEW_CRITERIA.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 p-4">
                <div className="min-w-0 w-full flex-1 sm:w-auto sm:min-w-[200px]">
                  <span className="break-words text-sm font-medium text-gray-900">{c.label}</span>
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
            {(application.status === "called_for_interview" || application.status === "interview") &&
              stageActions && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <DirectorStageActionBar
                    config={stageActions}
                    updating={updating}
                    onAction={handleStageAction}
                  />
                </div>
              )}
          </div>
        </div>
      )}

      <DirectorAssessorAssignmentPanel
        applicationId={id}
        applicationStatus={application.status}
      />

      {assessorReviews.length > 0 && (
        <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50/60 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">Assessor recommendations</h3>
          <p className="mt-1 text-xs text-gray-600">
            Advisory only. Official application status is unchanged until you take Director action below.
          </p>
          <ul className="mt-4 space-y-3">
            {assessorReviews.map((row) => (
              <li key={row.id} className="rounded-lg border border-amber-100 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-gray-900">
                    {row.assessor_name_snapshot || row.assessor_email_snapshot || "Assessor"}
                    {row.assessor_email_snapshot ? (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {row.assessor_email_snapshot}
                      </span>
                    ) : null}
                  </p>
                  <span className="text-xs text-gray-500">
                    {row.stage?.replace(/_/g, " ")} ·{" "}
                    {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"}
                  </span>
                </div>
                <p className="mt-2 text-royal">
                  Recommendation:{" "}
                  <strong>{(row.recommendation || "").replace(/_/g, " ")}</strong>
                  {row.overall_score != null ? ` · Score ${Number(row.overall_score).toFixed(2)}` : ""}
                </p>
                {row.notes ? <p className="mt-2 text-xs text-gray-600">{row.notes}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Director actions */}
      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Director Actions</h3>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Actions change with the current workflow stage. After Stage 2 approval, use{" "}
          <strong>Shortlist for Interview</strong> to add the applicant to the unscheduled queue, then
          schedule dates in bulk from <strong>Interviews</strong>. Final acceptance is only offered after
          the interview is marked complete.
        </p>
        {actionMessage ? (
          <div
            className={`mb-4 rounded-lg p-3 text-sm ${
              /fail|error|invalid/i.test(actionMessage)
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-800"
            }`}
          >
            {actionMessage}
            {/interview queue/i.test(actionMessage) ? (
              <div className="mt-2">
                <Link
                  href="/director/interviews"
                  className="text-sm font-semibold text-royal underline hover:text-gold"
                >
                  Go to Interview Scheduling
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
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

        {!isTerminal && stageActions && (
          <DirectorStageActionBar
            config={stageActions}
            updating={updating}
            onAction={handleStageAction}
          />
        )}
      </div>

      {showViewInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Interview details</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500">Date</dt>
                <dd className="mt-0.5 text-gray-900">{application.interview_date || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Time</dt>
                <dd className="mt-0.5 text-gray-900">{application.interview_time || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Location / meeting link</dt>
                <dd className="mt-0.5 break-words text-gray-900">
                  {application.interview_location || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Instructions</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-gray-900">
                  {application.interview_instructions || "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowViewInterviewModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => openInterviewModal({ reschedule: true })}
                className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-gold"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              {hasInterviewDetails || application.status === "called_for_interview" || application.status === "interview"
                ? "Reschedule interview"
                : "Schedule interview"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              We will notify the applicant by email with these details. This does not accept them into
              the programme.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
                <input
                  type="date"
                  value={interviewDraft.interview_date}
                  onChange={(e) => setInterviewDraft((d) => ({ ...d, interview_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                <input
                  type="text"
                  placeholder="e.g. 10:00 GMT"
                  value={interviewDraft.interview_time}
                  onChange={(e) => setInterviewDraft((d) => ({ ...d, interview_time: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-500">Location or meeting link</label>
              <input
                type="text"
                value={interviewDraft.interview_location}
                onChange={(e) => setInterviewDraft((d) => ({ ...d, interview_location: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-500">Instructions (optional)</label>
              <textarea
                rows={3}
                value={interviewDraft.interview_instructions}
                onChange={(e) => setInterviewDraft((d) => ({ ...d, interview_instructions: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInterviewModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  updating ||
                  !interviewDraft.interview_date?.trim() ||
                  !interviewDraft.interview_time?.trim() ||
                  !interviewDraft.interview_location?.trim()
                }
                onClick={() => updateStatus("called_for_interview")}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {updating ? "Saving…" : hasInterviewDetails ? "Save & notify" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h3 className="text-lg font-bold text-gray-900">Accept into Programme</h3>
            <p className="mt-1 text-sm text-gray-500">
              Final scholarship acceptance. Select the cohort class for this scholar. They will become a
              Scholar upon acceptance.
            </p>
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
