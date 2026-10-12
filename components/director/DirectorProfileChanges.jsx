"use client";

import { useEffect, useState } from "react";

export default function DirectorProfileChanges({ applicationId }) {
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/director/applications/${applicationId}/profile-changes`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setChanges(data.changes || []);
    }
    if (applicationId) load();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (changes.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Profile Changes</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {changes.map((change) => (
          <li key={change.id} className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="font-medium capitalize">{String(change.field).replace(/_/g, " ")}</span>
            <span className="mt-0.5 block text-xs text-gray-600">
              {String(change.previous)} → {String(change.next)} · {change.actor} ·{" "}
              {change.at ? new Date(change.at).toLocaleString() : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
