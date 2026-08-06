"use client";

import Link from "next/link";
import { applyNowHref, applyNowLabel } from "@/lib/apply-cta";

/**
 * Shared Apply Now control for public surfaces.
 * When closed: non-navigating status (unless linkWhenClosed → /apply prep page).
 */
export default function ApplyNowCta({
  applicationsOpen = false,
  className = "",
  closedClassName = "",
  children,
  onNavigate,
  linkWhenClosed = false,
  closedLabel,
}) {
  const open = Boolean(applicationsOpen);
  const label = children || applyNowLabel(open);

  if (!open) {
    if (linkWhenClosed) {
      return (
        <Link href={applyNowHref(false)} onClick={onNavigate} className={className || closedClassName}>
          {closedLabel || "Prepare to apply"}
        </Link>
      );
    }
    return (
      <span className={closedClassName || className} aria-disabled="true">
        {closedLabel || "Applications Closed"}
      </span>
    );
  }

  return (
    <Link href={applyNowHref(true)} onClick={onNavigate} className={className}>
      {label}
    </Link>
  );
}
