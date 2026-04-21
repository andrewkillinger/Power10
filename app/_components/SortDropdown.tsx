"use client";

import type { SortMode } from "@/lib/types";

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: "mostRecent", label: "Most recent article" },
  { value: "mostThisWeek", label: "Most articles this week" },
  { value: "lastName", label: "Alphabetical · last name" },
  { value: "outlet", label: "Alphabetical · outlet" },
];

export function SortDropdown({
  value,
  onChange,
  disabled,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-[12px] ${disabled ? "opacity-40" : ""}`}>
      <span className="font-mono uppercase tracking-wider text-ink-500">Sort</span>
      <div className="relative">
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value as SortMode)}
          className="appearance-none rounded-lg border border-black/10 bg-white px-3 py-1.5 pr-8
                     text-[12.5px] font-medium text-ink-900 shadow-sm transition
                     hover:border-black/20 focus:border-accent-vivid focus:outline-none
                     focus:ring-2 focus:ring-accent-vivid/25"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-500"
          width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden
        >
          <path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
