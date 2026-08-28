import { HelpCircle } from "lucide-react";
import {
  APPLICANT_SUPPORT_BODY,
  APPLICANT_SUPPORT_EMAIL,
  APPLICANT_SUPPORT_TITLE,
  applicantSupportMailto,
} from "@/lib/applicant-support";

/**
 * Reusable applicant support notice.
 * @param {{ variant?: "auth" | "dashboard" | "public" | "footer" }} props
 */
export default function ApplicantSupportNotice({ variant = "auth" }) {
  const mailto = applicantSupportMailto();

  if (variant === "footer") {
    return (
      <div data-applicant-support="footer">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          Application Support
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-white/50">
          {APPLICANT_SUPPORT_BODY}{" "}
          <a
            href={mailto}
            className="break-all font-medium text-gold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {APPLICANT_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  if (variant === "public") {
    return (
      <div
        className="rounded-xl border border-royal/15 bg-royal/5 p-5 text-center sm:p-6"
        data-applicant-support="public"
        role="note"
      >
        <h3 className="text-base font-bold text-royal sm:text-lg">{APPLICANT_SUPPORT_TITLE}</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          {APPLICANT_SUPPORT_BODY}{" "}
          <a
            href={mailto}
            className="break-all font-semibold text-royal underline-offset-2 hover:text-gold-dark hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
          >
            {APPLICANT_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  const isDashboard = variant === "dashboard";

  return (
    <div
      className={
        isDashboard
          ? "rounded-xl border border-royal/15 bg-royal/[0.03] p-4 sm:p-5"
          : "mt-6 rounded-lg border border-royal/15 bg-royal/[0.03] p-3.5 sm:p-4"
      }
      data-applicant-support={variant}
      role="note"
    >
      <div className="flex items-start gap-2.5">
        <HelpCircle
          size={isDashboard ? 18 : 16}
          className="mt-0.5 shrink-0 text-royal"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              isDashboard
                ? "text-sm font-semibold text-royal"
                : "text-xs font-semibold text-royal sm:text-sm"
            }
          >
            {APPLICANT_SUPPORT_TITLE}
          </p>
          <p
            className={
              isDashboard
                ? "mt-1 text-sm leading-relaxed text-gray-600"
                : "mt-1 text-[11px] leading-relaxed text-gray-600 sm:text-xs"
            }
          >
            {APPLICANT_SUPPORT_BODY}{" "}
            <a
              href={mailto}
              className="break-all font-semibold text-royal underline-offset-2 hover:text-gold-dark hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
            >
              {APPLICANT_SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
