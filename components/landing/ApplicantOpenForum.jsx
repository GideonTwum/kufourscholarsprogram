import Image from "next/image";
import { Calendar, Clock, Video } from "lucide-react";

/**
 * Temporary homepage announcement for the 11th Class Applicant Open Forum.
 * Remove this component (and its homepage import) after the event.
 *
 * Auto-hides server-side after 2026-08-31T22:30:00Z (hydration-safe).
 */
const EXPIRES_AT_MS = Date.parse("2026-08-31T22:30:00.000Z");

const ZOOM_URL =
  "https://us06web.zoom.us/j/85695400835?pwd=KSP8THCL";
const QUESTIONS_EMAIL = "twumgideonasare@gmail.com";
const FLYER_SRC = "/images/ksp-open-forum-aug-31-2026.png";
const FLYER_WIDTH = 1080;
const FLYER_HEIGHT = 1350;

export default function ApplicantOpenForum() {
  if (Date.now() >= EXPIRES_AT_MS) return null;

  return (
    <section
      id="applicant-open-forum"
      aria-labelledby="applicant-open-forum-heading"
      className="border-y border-royal/10 bg-gradient-to-b from-royal/[0.04] via-white to-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy + CTAs — first on mobile */}
          <div className="min-w-0">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Applicant Open Forum
            </span>
            <h2
              id="applicant-open-forum-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              Have Questions About Your Application?
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              Join the Kufuor Scholars Program Director and Management Team for
              an Open Forum on the 11th Class application process. Applicants
              can ask questions, seek clarification, and get guidance directly
              from the team.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-gray-700 sm:text-base">
              <li className="flex items-start gap-3">
                <Calendar
                  className="mt-0.5 shrink-0 text-royal"
                  size={18}
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-royal">Monday, 31 August 2026</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Clock
                  className="mt-0.5 shrink-0 text-royal"
                  size={18}
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-royal">8:30 PM GMT</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Video
                  className="mt-0.5 shrink-0 text-royal"
                  size={18}
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-royal">Online via Zoom</span>
                </span>
              </li>
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={ZOOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-sm font-semibold text-royal shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold-light hover:shadow-xl hover:shadow-gold/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Join Zoom Meeting
              </a>
              <a
                href={`mailto:${QUESTIONS_EMAIL}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-royal/25 bg-white px-7 py-3.5 text-sm font-semibold text-royal transition-all duration-200 hover:border-royal/45 hover:bg-royal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                Send Your Question
              </a>
            </div>

            <dl className="mt-8 grid gap-3 rounded-2xl border border-royal/10 bg-white/80 p-4 text-sm shadow-sm sm:grid-cols-2 sm:p-5">
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Meeting ID
                </dt>
                <dd className="mt-1 break-words font-semibold tabular-nums text-royal">
                  856 9540 0835
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Passcode
                </dt>
                <dd className="mt-1 break-words font-semibold tracking-wide text-royal">
                  KSP8THCL
                </dd>
              </div>
            </dl>
          </div>

          {/* Flyer — below copy on mobile; full width, no crop */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-royal/10 bg-white shadow-lg shadow-royal/10">
              <Image
                src={FLYER_SRC}
                alt="Kufuor Scholars Program Open Forum with the Director and Management Team, 31 August 2026 at 8:30 PM"
                width={FLYER_WIDTH}
                height={FLYER_HEIGHT}
                className="h-auto w-full"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
