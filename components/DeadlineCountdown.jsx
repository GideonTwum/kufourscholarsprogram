"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Shared live countdown against a server-provided ISO deadline.
 * Never goes negative; stops at zero. Absolute date should be shown by the parent.
 *
 * @param {{
 *   deadline: string,
 *   openLabel?: string,
 *   closedLabel?: string,
 *   variant?: "hero" | "card",
 * }} props
 */
export default function DeadlineCountdown({
  deadline,
  openLabel = "Closes in",
  closedLabel = null,
  variant = "card",
}) {
  const [remaining, setRemaining] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [passed, setPassed] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    setMounted(true);
    const target = new Date(deadline);
    if (Number.isNaN(target.getTime())) {
      setRemaining(null);
      setPassed(true);
      return () => {
        mountedRef.current = false;
      };
    }

    function tick() {
      if (!mountedRef.current) return;
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining({ days: 0, hours: 0, mins: 0, secs: 0 });
        setPassed(true);
        return;
      }
      setPassed(false);
      setRemaining({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [deadline]);

  if (!mounted || !remaining) return null;

  if (passed && closedLabel) {
    if (variant === "hero") {
      return (
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/80">
          <Clock size={16} />
          {closedLabel}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <Clock size={16} />
        {closedLabel}
      </div>
    );
  }

  if (passed) return null;

  const units = [
    { value: remaining.days, label: "DAYS" },
    { value: remaining.hours, label: "HRS" },
    { value: remaining.mins, label: "MIN" },
    { value: remaining.secs, label: "SEC" },
  ];

  if (variant === "hero") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-white/75">{openLabel}</span>
        <div className="flex gap-2">
          {units.map(({ value, label }) => (
            <div
              key={label}
              className="flex min-w-[3rem] flex-col items-center rounded-lg border border-white/30 bg-white/10 px-3 py-2"
            >
              <span className="text-lg font-bold text-white tabular-nums">
                {String(Math.max(0, value)).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase text-white/60">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{openLabel}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {units.map(({ value, label }) => (
          <div
            key={label}
            className="flex min-w-[3.5rem] flex-col items-center rounded-lg border border-royal/15 bg-white px-3 py-2 shadow-sm"
          >
            <span className="text-xl font-bold text-royal tabular-nums">
              {String(Math.max(0, value)).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
