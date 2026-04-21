"use client";

import type { ViewMode } from "@/lib/types";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const btn = (mode: ViewMode, label: string) => {
    const active = value === mode;
    return (
      <button
        type="button"
        onClick={() => onChange(mode)}
        aria-pressed={active}
        className={`relative rounded-md px-3 py-1.5 text-[12.5px] font-medium transition
          ${active
            ? "bg-white text-ink-900 shadow-sm ring-1 ring-black/5"
            : "text-ink-500 hover:text-ink-900"}`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-ink-100/70 p-1">
      {btn("kanban", "Kanban")}
      {btn("weekly", "This week · list")}
    </div>
  );
}
