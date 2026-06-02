"use client";

import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

export default function DirectorStageActionBar({
  config,
  updating,
  onAccept,
  onPending,
  onReject,
}) {
  if (!config) return null;

  const acceptDisabled = config.accept?.type === "disabled" || updating;
  const pendingDisabled = updating;

  return (
    <div className="w-full">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Current stage: {config.stageLabel}
      </p>
      {config.deferred && (
        <p className="mb-3 text-xs text-amber-700">This application is marked pending at this stage.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onAccept}
          disabled={acceptDisabled}
          title={config.accept?.reason || config.accept?.hint || ""}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          {config.accept?.label || "Accept"}
        </button>
        <button
          type="button"
          onClick={onPending}
          disabled={pendingDisabled}
          title={config.pending?.hint || ""}
          className="flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          <Clock size={14} />
          {config.pending?.label || "Pending"}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={updating}
          className="flex items-center gap-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
        >
          <XCircle size={14} />
          Reject
        </button>
        {updating && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>
      {config.accept?.type === "disabled" && config.accept?.reason && (
        <p className="mt-2 text-xs text-gray-500">{config.accept.reason}</p>
      )}
      {config.accept?.hint && config.accept?.type !== "disabled" && (
        <p className="mt-2 text-xs text-gray-500">{config.accept.hint}</p>
      )}
      {config.pending?.hint && (
        <p className="mt-1 text-xs text-gray-400">{config.pending.hint}</p>
      )}
    </div>
  );
}
