"use client";

import { formatOpenAnnouncement } from "@/lib/application-class";

/**
 * Compact recruitment notice — own row above the navbar.
 * No Apply CTA here: navbar keeps the single primary gold Apply Now.
 */
export default function ClassRecruitmentBanner({
  applicationsOpen = false,
  applicationClassName = "11th Class",
}) {
  if (!applicationsOpen) return null;

  return (
    <div
      className="border-b border-gold/25 bg-royal-dark text-white"
      data-recruitment-banner="true"
      role="region"
      aria-label="Application announcement"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-4 sm:h-10 sm:px-6 lg:justify-start lg:px-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-gold sm:text-xs">
          {formatOpenAnnouncement(applicationClassName)}
        </p>
      </div>
    </div>
  );
}
