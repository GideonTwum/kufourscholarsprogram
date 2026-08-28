"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import ClassRecruitmentBanner from "@/components/landing/ClassRecruitmentBanner";
import Navbar from "@/components/landing/Navbar";
import StaffApplyNotice from "@/components/landing/StaffApplyNotice";

/**
 * Fixed two-layer site header:
 * 1) ClassRecruitmentBanner (when applications open)
 * 2) Navbar
 *
 * Sets --site-header-height and renders a matching spacer so page content
 * (including the homepage hero) begins below the full header — no overlap.
 */
export default function SiteHeader({
  applicationsOpen = false,
  applicationClassName = "11th Class",
}) {
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(applicationsOpen ? 104 : 64);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        setHeaderHeight(h);
        document.documentElement.style.setProperty("--site-header-height", `${h}px`);
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [applicationsOpen, applicationClassName]);

  return (
    <>
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-50"
        data-site-header="true"
      >
        <Suspense fallback={null}>
          <StaffApplyNotice />
        </Suspense>
        <ClassRecruitmentBanner
          applicationsOpen={applicationsOpen}
          applicationClassName={applicationClassName}
        />
        <Navbar applicationsOpen={applicationsOpen} embedded />
      </header>
      <div
        aria-hidden="true"
        data-site-header-spacer="true"
        style={{ height: headerHeight }}
      />
    </>
  );
}
