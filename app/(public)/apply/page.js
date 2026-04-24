import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  CheckCircle,
  Calendar,
  FileText,
  Lightbulb,
  ArrowRight,
  Clock,
} from "lucide-react";

export const metadata = {
  title: "Apply | Kufuor Scholars Program",
  description:
    "Learn about eligibility, application timeline, and tips for applying to the Kufuor Scholars Program.",
};

const eligibility = [
  "Citizen of an African country — not limited to Ghanaian nationals",
  "Aged 25 or under at time of application",
  "Currently enrolled in a recognized tertiary institution in Ghana",
  "Demonstrated leadership potential and community involvement",
  "Strong academic record",
  "Commitment to the 3-year program",
];

const timeline = [
  { phase: "Applications open", description: "Submit your application and create an account." },
  { phase: "Review period", description: "Applications are reviewed by our selection committee." },
  { phase: "Interviews", description: "Shortlisted candidates are invited for interviews." },
  { phase: "Final selection", description: "Successful scholars are notified and welcomed to the cohort." },
];

const tips = [
  "Be authentic—share your genuine leadership journey and aspirations.",
  "Highlight community impact and extracurricular involvement.",
  "Demonstrate how you align with our core values: integrity, patriotism, transparency, accountability.",
  "Proofread your application carefully before submitting.",
  "Prepare for interviews by reflecting on your leadership experiences.",
];

export default async function ApplyPage() {
  let applicationsOpen = false;
  let applicationDeadline = null;

  try {
    const supabase = await createClient();
    const { data: openSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "applications_open")
      .single();
    if (openSetting) applicationsOpen = openSetting.value === "true";

    const { data: deadlineSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "application_deadline")
      .single();
    if (deadlineSetting?.value) {
      const d = new Date(deadlineSetting.value);
      if (!isNaN(d.getTime())) applicationDeadline = deadlineSetting.value;
    }
  } catch {}

  return (
    <div className="pt-24">
      {/* Hero */}
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Apply to the Program
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Everything you need to know before submitting your application for
            the Kufuor Scholars Program.
          </p>
          {applicationsOpen && applicationDeadline && (
            <div className="mt-6 flex items-center gap-2 text-white/80">
              <Clock size={18} />
              <span>
                Applications close{" "}
                {new Date(applicationDeadline).toLocaleDateString("en-GB", {
                  dateStyle: "long",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Eligibility */}
        <section>
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Who Can Apply
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Eligibility Requirements
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            The program is open to <strong>all African nationals</strong> (not
            only Ghanaian citizens) who are <strong>currently enrolled</strong>{" "}
            at a tertiary institution in Ghana and meet the age limit below.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {eligibility.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3"
              >
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-gold" />
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Application Timeline */}
        <section className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            What to Expect
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Application Timeline
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            The selection process typically follows these stages:
          </p>
          <div className="mt-8 space-y-6">
            {timeline.map((step, i) => (
              <div
                key={step.phase}
                className="flex gap-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-royal">{step.phase}</h3>
                  <p className="mt-1 text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Application Tips
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Tips for a Strong Application
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            Stand out by following these recommendations:
          </p>
          <ul className="mt-8 space-y-4">
            {tips.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
              >
                <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
                <span className="text-gray-700">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-24 rounded-2xl bg-royal/5 p-8 sm:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <FileText className="mx-auto h-12 w-12 text-gold" />
            <h2 className="mt-4 text-2xl font-bold text-royal sm:text-3xl">
              Ready to Apply?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              {applicationsOpen
                ? "Create an account and submit your application before the deadline."
                : "Applications are currently closed. Check back later for the next cohort."}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {applicationsOpen ? (
                <Link
                  href="/applicant-register"
                  className="inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-3 text-sm font-semibold text-royal transition-colors hover:bg-gold-light"
                >
                  Start Application
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-8 py-3 text-sm font-medium text-gray-500">
                  Applications Closed
                </span>
              )}
              <Link
                href="/about#program"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-royal px-8 py-3 text-sm font-semibold text-royal transition-colors hover:bg-royal/5"
              >
                Learn About the Program
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
