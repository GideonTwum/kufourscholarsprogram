"use client";

import Link from "next/link";
import { Calendar, CheckCircle2, Clock, Eye, Loader2, XCircle } from "lucide-react";

function iconFor(action) {
  if (action.type === "view_interview") return Eye;
  if (
    action.type === "href" ||
    action.type === "interview_modal" ||
    /schedule|interview|shortlist/i.test(action.label || "")
  ) {
    return Calendar;
  }
  if (action.type === "reject" || action.variant === "danger") return XCircle;
  if (/pending|defer|remove/i.test(action.label || "")) return Clock;
  return CheckCircle2;
}

function buttonClass(variant) {
  switch (variant) {
    case "secondary":
      return "bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50";
    case "danger":
      return "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50";
    case "neutral":
      return "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50";
    case "primary":
    default:
      return "bg-royal text-gold hover:bg-royal/90 disabled:cursor-not-allowed disabled:opacity-50";
  }
}

export default function DirectorStageActionBar({
  config,
  updating,
  onAction,
  onAccept,
  onPending,
  onReject,
}) {
  if (!config) return null;

  const actions =
    Array.isArray(config.actions) && config.actions.length > 0
      ? config.actions.filter(Boolean)
      : [config.primary || config.accept, config.secondary || config.pending, config.danger || config.reject].filter(
          Boolean
        );

  function handleClick(action) {
    if (!action || action.type === "disabled" || updating) return;
    if (typeof onAction === "function") {
      onAction(action);
      return;
    }
    if (action.type === "reject") onReject?.();
    else if (/pending/i.test(action.label || "") && action.type === "status") onPending?.();
    else onAccept?.();
  }

  return (
    <div className="w-full min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Current stage: {config.stageLabel}
      </p>
      {config.deferred ? (
        <p className="mb-2 text-xs text-amber-700">This application is in the interview queue (unscheduled).</p>
      ) : null}
      {config.helperText ? <p className="mb-3 text-xs text-gray-500">{config.helperText}</p> : null}

      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon = iconFor(action);
          const disabled = action.type === "disabled" || updating;
          const className = `inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${buttonClass(
            action.variant || "primary"
          )}`;
          const key = `${action.type}-${action.label}-${action.next || action.href || ""}`;

          if (action.type === "href" && action.href) {
            return (
              <Link key={key} href={action.href} className={className} title={action.hint || ""}>
                <Icon size={14} aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleClick(action)}
              disabled={disabled}
              title={action.reason || action.hint || ""}
              className={className}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
        {updating ? <Loader2 size={16} className="animate-spin self-center text-gray-400" /> : null}
      </div>
    </div>
  );
}
