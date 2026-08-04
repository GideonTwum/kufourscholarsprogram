"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";

export default function DirectorAuditLogPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    action: "",
    entity_type: "",
    actor: "",
    q: "",
    from: "",
    to: "",
  });
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/director/audit-log?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load audit log");
      setEvents([]);
    } else {
      setEvents(data.events || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Immutable record of privileged Director actions. Passwords and secrets are never stored here.
        </p>
      </div>

      <form
        className="mb-6 grid gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input
          placeholder="Action"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Entity type"
          value={filters.entity_type}
          onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Actor"
          value={filters.actor}
          onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Search entity / email"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white"
        >
          <Search size={14} /> Filter
        </button>
      </form>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-royal" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          No audit events match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{ev.action}</p>
                  <p className="text-xs text-gray-500">
                    {ev.actor_name_snapshot || ev.actor_email_snapshot || "System"} · {ev.entity_type}
                    {ev.entity_id ? ` · ${ev.entity_id}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                </p>
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-royal"
                onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
              >
                {expanded === ev.id ? "Hide details" : "Show old/new values"}
              </button>
              {expanded === ev.id && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] text-gray-700">
                  {JSON.stringify(
                    { old_value: ev.old_value, new_value: ev.new_value, metadata: ev.metadata },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
        <span>
          Page {page} of {pages} ({total} events)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
