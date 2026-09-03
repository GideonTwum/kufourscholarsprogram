"use client";

import { useEffect, useMemo, useState } from "react";
import { Building, ChevronDown, Search } from "lucide-react";
import {
  GHANA_TERTIARY_INSTITUTIONS,
  OTHER_INSTITUTION_OPTION,
  OTHER_INSTITUTION_SELECT_VALUE,
  findCanonicalTertiaryInstitution,
} from "@/lib/ghana-tertiary-institutions";

/**
 * Searchable university/institution select with "Other institution / Not listed".
 * Persists only applications.university (canonical name or Other free text).
 */
export default function InstitutionSelect({
  value = "",
  onChange,
  error = false,
  otherError = false,
  otherErrorMessage = "",
}) {
  const stored = typeof value === "string" ? value : "";
  const canonical = findCanonicalTertiaryInstitution(stored);
  const [mode, setMode] = useState(() => {
    if (canonical) return "canonical";
    if (stored) return "other";
    return "unset";
  });
  const [otherName, setOtherName] = useState(() =>
    !canonical && stored ? stored : ""
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const nextCanonical = findCanonicalTertiaryInstitution(stored);
    if (nextCanonical) {
      setMode("canonical");
      setOtherName("");
      return;
    }
    if (stored) {
      setMode("other");
      setOtherName(stored);
    }
  }, [stored]);

  const selectValue =
    mode === "other"
      ? OTHER_INSTITUTION_SELECT_VALUE
      : mode === "canonical" && canonical
        ? canonical
        : mode === "canonical" && stored
          ? stored
          : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GHANA_TERTIARY_INSTITUTIONS;
    return GHANA_TERTIARY_INSTITUTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  const base =
    "w-full appearance-none rounded-lg border py-2.5 pl-10 pr-8 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
  const border = error ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-200";
  const otherBorder = otherError
    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
    : "border-gray-200";

  function handleSelect(next) {
    if (next === OTHER_INSTITUTION_SELECT_VALUE) {
      setMode("other");
      onChange(otherName.trim());
      return;
    }
    if (!next) {
      setMode("unset");
      setOtherName("");
      onChange("");
      return;
    }
    setMode("canonical");
    setOtherName("");
    onChange(next);
  }

  function handleOtherName(next) {
    setOtherName(next);
    setMode("other");
    onChange(next.trim() ? next : "");
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search institutions…"
            aria-label="Search universities and institutions"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
        <div className="relative">
          <Building
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
          />
          <select
            id="university"
            value={selectValue}
            onChange={(e) => handleSelect(e.target.value)}
            className={`${base} ${border}`}
            aria-invalid={error || undefined}
          >
            <option value="">Select university / institution</option>
            {canonical && !filtered.includes(canonical) ? (
              <option value={canonical}>{canonical}</option>
            ) : null}
            {filtered.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={OTHER_INSTITUTION_SELECT_VALUE}>{OTHER_INSTITUTION_OPTION}</option>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        </div>
        {query && filtered.length === 0 ? (
          <p className="text-xs text-gray-500">
            No institutions match “{query}”. Choose “{OTHER_INSTITUTION_OPTION}” to enter a name.
          </p>
        ) : null}
      </div>

      {mode === "other" ? (
        <div>
          <label
            htmlFor="university_other_name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Name of Institution <span className="text-red-500">*</span>
          </label>
          <input
            id="university_other_name"
            type="text"
            value={otherName}
            onChange={(e) => handleOtherName(e.target.value)}
            placeholder="Enter the full name of your institution"
            className={`w-full rounded-lg border py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20 ${otherBorder}`}
            aria-invalid={otherError || undefined}
          />
          {otherErrorMessage ? (
            <p className="mt-1 text-xs text-red-600">{otherErrorMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
