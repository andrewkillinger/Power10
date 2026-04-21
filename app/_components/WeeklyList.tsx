import type { Article, Journalist } from "@/lib/types";
import { isWithinLastWeek } from "@/lib/freshness";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function WeeklyList({
  journalists,
  articles,
}: {
  journalists: Journalist[];
  articles: Article[];
}) {
  const byId = new Map(journalists.map((j) => [j.id, j]));
  const rows = articles
    .filter((a) => isWithinLastWeek(a.publishedAt))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  if (rows.length === 0) {
    return (
      <div className="mx-6 my-10 rounded-2xl border border-dashed border-black/10 bg-white/60 p-12 text-center text-ink-500">
        No articles in the past 7 days.
      </div>
    );
  }

  return (
    <div className="mx-6 my-6 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="bg-ink-100/50 font-mono text-[10.5px] uppercase tracking-wider text-ink-500">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Journalist</th>
            <th className="px-4 py-3 font-medium">Outlet</th>
            <th className="px-4 py-3 font-medium">Headline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const j = byId.get(a.journalistId);
            return (
              <tr
                key={a.id}
                className="border-t border-black/5 transition hover:bg-ink-100/30"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">
                  {fmtDate(a.publishedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">
                  {fmtTime(a.publishedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink-900">
                  {j?.displayName ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">
                  {a.outlet}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-900 underline-offset-4 hover:text-accent-vivid hover:underline"
                  >
                    {a.headline}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
