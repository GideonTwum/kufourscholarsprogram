"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export default function AlumniDirectory({
  alumni = [],
  cohorts = [],
  universities = [],
  selectedCohort = "",
  selectedUniversity = "",
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return alumni;
    const q = search.toLowerCase();
    return alumni.filter(
      (a) =>
        (a.full_name || "").toLowerCase().includes(q) ||
        (a.university || "").toLowerCase().includes(q) ||
        (a.field_of_study || "").toLowerCase().includes(q) ||
        (a.cohort_year || "").toLowerCase().includes(q) ||
        (a.achievements || "").toLowerCase().includes(q)
    );
  }, [alumni, search]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by name, university, or achievements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCohort}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("cohort", e.target.value);
              else url.searchParams.delete("cohort");
              window.location.href = url.pathname + url.search;
            }}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold"
          >
            <option value="">All Cohorts</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={selectedUniversity}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set("university", e.target.value);
              else url.searchParams.delete("university");
              window.location.href = url.pathname + url.search;
            }}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold"
          >
            <option value="">All Universities</option>
            {universities.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-16 text-center">
          <p className="text-lg font-medium text-gray-500">
            No alumni found.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {alumni.length === 0
              ? "Alumni profiles will appear here once scholars are marked as alumni."
              : "Try adjusting your search or filters."}
          </p>
          <Link
            href="/scholars"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-royal hover:text-gold"
          >
            View current scholars →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => (
            <Link
              key={person.id}
              href={`/scholars/${person.cohort_year}/${person.slug}`}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-royal/20 text-xl font-bold text-royal">
                  {(person.full_name || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-royal transition-colors group-hover:text-gold">
                    {person.full_name}
                  </h3>
                  <p className="mt-1 text-sm text-gold font-medium">
                    Cohort {person.cohort_year}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {[person.university, person.field_of_study]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {person.quote && (
                    <p className="mt-3 line-clamp-2 text-sm italic text-gray-500">
                      &ldquo;{person.quote}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
