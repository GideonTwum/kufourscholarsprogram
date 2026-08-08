"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

/**
 * Accessible searchable country select.
 * Uses native <select> filtered via a search box for mobile/keyboard support.
 */
export default function CountrySelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = "Select country",
  error = false,
  className = "",
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.toLowerCase().includes(q));
  }, [options, query]);

  const base =
    "w-full appearance-none rounded-lg border py-2.5 pl-10 pr-8 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
  const border = error ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-gray-200";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          disabled={disabled}
          aria-label="Search countries"
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
      </div>
      <div className="relative">
        <select
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${base} ${border}`}
        >
          <option value="">{placeholder}</option>
          {value && !filtered.includes(value) && options.includes(value) ? (
            <option value={value}>{value}</option>
          ) : null}
          {value && !filtered.includes(value) && !options.includes(value) ? (
            <option value={value}>{value} (saved)</option>
          ) : null}
          {filtered.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
      </div>
      {query && filtered.length === 0 ? (
        <p className="text-xs text-gray-500">No countries match “{query}”.</p>
      ) : null}
    </div>
  );
}
