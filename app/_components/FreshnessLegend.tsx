export function FreshnessLegend() {
  const item = (
    freshness: "fresh" | "recent" | "stale",
    label: string,
    sub: string,
  ) => (
    <div className="flex items-center gap-2">
      <span
        data-freshness={freshness}
        className="relative h-5 w-5 overflow-hidden rounded-md border"
        aria-hidden
      >
        <span className="rail absolute left-0 top-0 h-full w-[3px]" />
      </span>
      <div className="leading-tight">
        <div className="text-[11.5px] font-medium text-ink-900">{label}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{sub}</div>
      </div>
    </div>
  );
  return (
    <div className="hidden items-center gap-4 md:flex">
      {item("fresh", "Fresh", "< 24h")}
      {item("recent", "Recent", "< 7d")}
      {item("stale", "Older", "7d +")}
    </div>
  );
}
