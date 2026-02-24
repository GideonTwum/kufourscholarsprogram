"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  GraduationCap,
  PenLine,
  FileText,
  Video,
  ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Users,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

const statusFlow = [
  { key: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-700" },
  {
    key: "under_review",
    label: "Under Review",
    color: "bg-amber-100 text-amber-700",
  },
  {
    key: "shortlisted",
    label: "Shortlisted",
    color: "bg-purple-100 text-purple-700",
  },
  {
    key: "interview",
    label: "Interview",
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    key: "accepted",
    label: "Accepted",
    color: "bg-green-100 text-green-700",
  },
  {
    key: "rejected",
    label: "Rejected",
    color: "bg-red-100 text-red-700",
  },
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

export default function ApplicationReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [application, setApplication] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedClass, setSelectedClass] = useState("Class of 2029");
  const [showAcceptModal, setShowAcceptModal] = useState(false);

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
      setLoading(false);
    }
    load();
  }, [id]);

  async function updateStatus(newStatus) {
    setUpdating(true);
    const body = { status: newStatus, director_notes: notes };
    if (newStatus === "accepted") {
      body.class_name = selectedClass;
    }

    const res = await fetch(`/api/applications/${id}/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setApplication((prev) => ({ ...prev, status: newStatus, director_notes: notes }));
      if (newStatus === "accepted") {
        setProfile((prev) => ({ ...prev, role: "scholar", class_name: selectedClass }));
      }
      setShowAcceptModal(false);
    }
    setUpdating(false);
  }

  const [docUrls, setDocUrls] = useState({});

  useEffect(() => {
    if (!application) return;
    const paths = {
      cv_url: application.cv_url,
      recommendation_url: application.recommendation_url,
      photo_url: application.photo_url,
    };
    const fetchSignedUrls = async () => {
      const urls = {};
      for (const [field, path] of Object.entries(paths)) {
        if (!path) continue;
        try {
          const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          if (data.url) urls[field] = data.url;
        } catch (_) {}
      }
      setDocUrls(urls);
    };
    fetchSignedUrls();
  }, [application?.id, application?.cv_url, application?.recommendation_url, application?.photo_url]);

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

  const currentStatusIndex = statusFlow.findIndex(
    (s) => s.key === application.status
  );
  const isTerminal =
    application.status === "accepted" || application.status === "rejected";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/director/applications"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-royal"
        >
          <ArrowLeft size={14} />
          Back to Applications
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-royal text-lg font-bold text-gold">
              {profile?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {application.full_name || profile?.full_name || "Unknown"}
              </h1>
              <p className="text-sm text-gray-500">{profile?.email}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              statusFlow.find((s) => s.key === application.status)?.color ||
              "bg-gray-100 text-gray-600"
            }`}
          >
            {statusFlow.find((s) => s.key === application.status)?.label ||
              application.status}
          </span>
        </div>
      </div>

      {/* Status progress bar */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center">
          {statusFlow.slice(0, 4).map((s, i) => {
            const completed = i < currentStatusIndex;
            const active = s.key === application.status;
            return (
              <div key={s.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      completed
                        ? "bg-royal text-white"
                        : active
                          ? "bg-gold text-royal ring-4 ring-gold/20"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {completed ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span className="mt-1 text-[10px] font-medium text-gray-500">
                    {s.label}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className={`mx-1 h-0.5 flex-1 ${
                      completed ? "bg-royal" : "bg-gray-200"
                    }`}
                  />
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
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-semibold text-red-700">
            Application Rejected
          </div>
        )}
      </div>

      {/* Application details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Personal Information" icon={User}>
          <dl className="grid grid-cols-2 gap-x-6">
            <Field label="Full Name" value={application.full_name} />
            <Field label="Date of Birth" value={application.date_of_birth} />
            <Field label="Phone" value={application.phone} />
            <Field label="Nationality" value={application.nationality} />
            <Field label="Address" value={application.address} />
          </dl>
        </Section>

        <Section title="Academic Information" icon={GraduationCap}>
          <dl className="grid grid-cols-2 gap-x-6">
            <Field label="University" value={application.university} />
            <Field label="Program" value={application.program} />
            <Field label="Year of Study" value={application.year_of_study} />
            <Field label="GPA / Grade" value={application.gpa} />
          </dl>
        </Section>

        <Section title="Personal Statement" icon={PenLine}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {application.essay || "No essay provided."}
          </p>
        </Section>

        <Section title="Video Introduction" icon={Video}>
          {application.video_url ? (
            <a
              href={application.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-royal/5 px-4 py-3 text-sm font-medium text-royal hover:bg-royal/10"
            >
              <ExternalLink size={14} />
              Watch Video
            </a>
          ) : (
            <p className="text-sm text-gray-400">No video provided.</p>
          )}
        </Section>

        <div className="lg:col-span-2">
          <Section title="Documents" icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "CV / Resume", field: "cv_url", icon: FileText },
                {
                  label: "Recommendation Letter",
                  field: "recommendation_url",
                  icon: FileText,
                },
                {
                  label: "Passport Photo",
                  field: "photo_url",
                  icon: ImageIcon,
                },
              ].map((doc) => {
                const hasFile = !!application[doc.field];
                const url = docUrls[doc.field];
                return (
                  <div
                    key={doc.field}
                    className="rounded-lg border border-gray-100 p-4"
                  >
                    <doc.icon size={20} className="mb-2 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {doc.label}
                    </p>
                    {!hasFile ? (
                      <p className="mt-1 text-xs text-gray-400">
                        Not uploaded
                      </p>
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
                      <p className="mt-1 text-xs text-amber-600">
                        Loading…
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>

      {/* Director actions */}
      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-gray-900">
          Director Actions
        </h3>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Internal Notes
          </label>
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
            {application.status === "submitted" && (
              <button
                onClick={() => updateStatus("under_review")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <Search size={14} />
                Mark Under Review
              </button>
            )}
            {application.status === "under_review" && (
              <button
                onClick={() => updateStatus("shortlisted")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
              >
                <Users size={14} />
                Shortlist
              </button>
            )}
            {application.status === "shortlisted" && (
              <button
                onClick={() => updateStatus("interview")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                <Video size={14} />
                Move to Interview
              </button>
            )}
            {(application.status === "interview" ||
              application.status === "shortlisted" ||
              application.status === "under_review") && (
              <>
                <button
                  onClick={() => setShowAcceptModal(true)}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Accept
                </button>
                <button
                  onClick={() => updateStatus("rejected")}
                  disabled={updating}
                  className="flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </>
            )}
            {updating && (
              <Loader2 size={16} className="animate-spin text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Accept modal — class assignment */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              Accept Applicant
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Assign this applicant to a cohort. They will become a Scholar upon
              acceptance.
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Assign to Cohort
              </label>
              <div className="relative">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {cohortOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAcceptModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus("accepted")}
                disabled={updating}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Confirm Acceptance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
