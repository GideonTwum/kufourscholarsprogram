"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  FileText,
  ArrowRight,
  CheckCircle2,
  Search,
  Users,
  Video,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
} from "lucide-react";

const statusSteps = [
  { key: "stage_1_submitted", label: "Pending", icon: Search },
  { key: "stage_1_approved", label: "Stage 1 ✓", icon: Users },
  { key: "stage_2_submitted", label: "Stage 2 in review", icon: Video },
  { key: "stage_2_approved", label: "Stage 2 ✓", icon: Video },
  { key: "called_for_interview", label: "Interview", icon: Video },
];

function InterviewScheduledCard({ slot, onFirstView }) {
  useEffect(() => {
    onFirstView?.();
  }, [onFirstView]);

  if (!slot) return null;

  return (
    <div className="rounded-xl border-2 border-gold/30 bg-gradient-to-br from-royal/5 to-gold/10 p-6 text-center">
      <div className="mb-4 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-royal text-gold">
          <Video size={28} />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900">
        Congratulations! You&apos;re Invited for an Interview
      </h3>
      {slot.congratulations_message && (
        <p className="mt-2 text-sm text-gray-700">{slot.congratulations_message}</p>
      )}
      <div className="mt-6 space-y-3 rounded-lg bg-white/80 p-4 text-left">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal/10 text-royal">
            <Users size={14} />
          </span>
          <div>
            <p className="font-medium text-gray-500">Your Group / Batch</p>
            <p className="font-semibold text-gray-900">{slot.batch_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal/10 text-royal">
            <Calendar size={14} />
          </span>
          <div>
            <p className="font-medium text-gray-500">Date & Time</p>
            <p className="font-semibold text-gray-900">
              {new Date(slot.interview_date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              at {slot.interview_time}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal/10 text-royal">
            <MapPin size={14} />
          </span>
          <div>
            <p className="font-medium text-gray-500">Location</p>
            <p className="font-semibold text-gray-900">{slot.location}</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Please arrive 15 minutes early. We look forward to meeting you!
      </p>
    </div>
  );
}

function fireConfetti() {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then(({ default: confetti }) => {
    const count = 200;
    const defaults = { origin: { y: 0.6 } };
    confetti({ ...defaults, particleCount: count, spread: 80, colors: ["#1e3a5f", "#c9a227", "#ffffff"] });
    confetti({ ...defaults, particleCount: count * 0.3, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ ...defaults, particleCount: count * 0.3, angle: 120, spread: 55, origin: { x: 1 } });
  });
}

export default function ApplicantDashboard() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFiredConfetti = useRef(false);

  useEffect(() => {
    async function load() {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profErr) setError(profErr.message);
      setProfile(prof);

      const { data: app } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      let applicationData = app;
      if (
        app?.interview_slot_id &&
        (app?.status === "called_for_interview" || app?.status === "interview")
      ) {
        const { data: slot } = await supabase
          .from("interview_slots")
          .select("batch_name, interview_date, interview_time, location, congratulations_message")
          .eq("id", app.interview_slot_id)
          .single();
        if (slot) {
          applicationData = { ...app, interview_slot_data: slot };
        }
      }
      setApplication(applicationData);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={24} className="shrink-0 text-red-500" />
          <div>
            <h2 className="font-semibold text-red-800">Something went wrong</h2>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <p className="mt-2 text-xs text-red-600">Try refreshing the page. If the problem persists, please contact support.</p>
          </div>
        </div>
      </div>
    );
  }

  const statusOrder = [
    "stage_1_submitted",
    "stage_1_approved",
    "stage_2_submitted",
    "stage_2_approved",
    "called_for_interview",
  ];
  const statusToProgressIndex = (status) => statusOrder.indexOf(status);
  const currentIndex = application ? statusToProgressIndex(application.status) : -1;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {profile?.full_name?.split(" ")[0] || "Applicant"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your application progress and stay updated.
        </p>
      </div>

      {/* Application status */}
      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-gray-900">Application Status</h2>

        {!application || application.status === "draft" ? (
          <div className="text-center py-6">
            <FileText size={40} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              {application?.status === "draft"
                ? "Your application is saved as a draft."
                : "You haven't started your application yet."}
            </p>
            <Link
              href="/applicant/application"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-royal px-5 py-2.5 text-sm font-semibold text-white hover:bg-royal-light"
            >
              {application?.status === "draft"
                ? "Continue Application"
                : "Start Application"}
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : application.status === "accepted" ? (
          <div className="rounded-lg bg-green-50 p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h3 className="mt-3 text-lg font-bold text-green-800">
              Congratulations!
            </h3>
            <p className="mt-1 text-sm text-green-700">
              Your application has been accepted into the Kufuor Scholars
              Program!
            </p>
          </div>
        ) : application.status === "called_for_interview" &&
          application.interview_date &&
          !application.interview_slot_id ? (
          <div className="rounded-xl border-2 border-gold/30 bg-gradient-to-br from-royal/5 to-gold/10 p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-royal text-gold">
                <Video size={28} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900">You&apos;re Invited for an Interview</h3>
            <div className="mt-6 space-y-3 rounded-lg bg-white/80 p-4 text-left text-sm">
              <p>
                <span className="font-medium text-gray-500">Date: </span>
                <span className="text-gray-900">
                  {new Date(application.interview_date).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
              <p>
                <span className="font-medium text-gray-500">Time: </span>
                <span className="text-gray-900">{application.interview_time}</span>
              </p>
              <p>
                <span className="font-medium text-gray-500">Location / link: </span>
                <span className="text-gray-900">{application.interview_location}</span>
              </p>
              {application.interview_instructions ? (
                <p>
                  <span className="font-medium text-gray-500">Instructions: </span>
                  <span className="text-gray-900">{application.interview_instructions}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (application.status === "called_for_interview" || application.status === "interview") &&
          application.interview_slot_id &&
          application.interview_slot_data ? (
          <InterviewScheduledCard
            slot={application.interview_slot_data}
            onFirstView={() => {
              if (!hasFiredConfetti.current) {
                hasFiredConfetti.current = true;
                fireConfetti();
              }
            }}
          />
        ) : application.status === "rejected" ? (
          <div className="rounded-lg bg-red-50 p-6 text-center">
            <XCircle size={40} className="mx-auto text-red-500" />
            <h3 className="mt-3 text-lg font-bold text-red-800">
              Application Not Successful
            </h3>
            <p className="mt-1 text-sm text-red-700">
              Unfortunately, your application was not successful this time.
              Thank you for your interest.
            </p>
            {application.rejection_reason ? (
              <p className="mt-4 rounded-lg bg-white/80 p-3 text-left text-sm text-red-900">
                {application.rejection_reason}
              </p>
            ) : null}
          </div>
        ) : application.status === "stage_1_approved" ? (
          <div className="rounded-lg border-2 border-gold/30 bg-gradient-to-br from-royal/5 to-gold/10 p-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-royal">
                <Video size={28} />
              </div>
            </div>
            <h3 className="text-center text-xl font-bold text-gray-900">
              Congratulations! You&apos;re Shortlisted for Stage 2
            </h3>
            <p className="mt-2 text-center text-sm text-gray-700">
              Submit your poster presentation video. Create a 3-minute video on a community problem, outlining the identified problem, cause, effect, intervention, and expected outcome.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/applicant/stage2"
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-royal hover:bg-gold/90"
              >
                <Video size={18} />
                Submit Stage 2 Video
              </Link>
            </div>
          </div>
        ) : application.status === "stage_2_submitted" ? (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto text-indigo-600" />
            <h3 className="mt-3 text-lg font-bold text-gray-900">
              Stage 2 Submitted
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Your video has been received. We will review it and notify you of the outcome.
            </p>
          </div>
        ) : application.status === "stage_2_approved" ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-6 text-center">
            <Video size={40} className="mx-auto text-amber-600" />
            <h3 className="mt-3 text-lg font-bold text-gray-900">Stage 2 approved</h3>
            <p className="mt-1 text-sm text-gray-600">
              The committee has approved your Stage 2 submission. You will receive interview details here and by email when scheduled.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            {statusSteps.map((s, i) => {
              const completed = i < currentIndex;
              const active = i === currentIndex;
              const StepIcon = s.icon;
              return (
                <div key={s.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        completed
                          ? "bg-royal text-white"
                          : active
                            ? "bg-gold text-royal ring-4 ring-gold/20"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <StepIcon size={18} />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-[11px] font-medium ${
                        active ? "text-royal" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < statusSteps.length - 1 && (
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
        )}
      </div>

    </div>
  );
}
