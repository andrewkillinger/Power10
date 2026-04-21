"use client";

import { useMemo, useState } from "react";
import type { Article, Journalist, SortMode, ViewMode } from "@/lib/types";
import { groupArticlesByJournalist, sortJournalists } from "@/lib/sort";
import { KanbanBoard } from "./KanbanBoard";
import { WeeklyList } from "./WeeklyList";
import { SortDropdown } from "./SortDropdown";
import { ViewToggle } from "./ViewToggle";
import { FreshnessLegend } from "./FreshnessLegend";

export function DashboardShell({
  journalists,
  articles,
  lastUpdated,
  usingMockData,
}: {
  journalists: Journalist[];
  articles: Article[];
  lastUpdated: string | null;
  usingMockData: boolean;
}) {
  const [view, setView] = useState<ViewMode>("kanban");
  const [sort, setSort] = useState<SortMode>("mostRecent");

  const articlesByJournalist = useMemo(
    () => groupArticlesByJournalist(articles),
    [articles],
  );

  const sortedJournalists = useMemo(
    () =>
      sortJournalists(journalists, sort, {
        articlesByJournalist,
        now: new Date(),
      }),
    [journalists, sort, articlesByJournalist],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900">
              Journalist Desk
            </h1>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-500">
              Power10
            </span>
            {usingMockData ? (
              <span
                title="Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to load live data."
                className="rounded-full border border-accent-warm/30 bg-accent-warm/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-warm"
              >
                Sample data
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <FreshnessLegend />
            <ViewToggle value={view} onChange={setView} />
            <SortDropdown
              value={sort}
              onChange={setSort}
              disabled={view === "weekly"}
            />
          </div>
        </div>
        {lastUpdated ? (
          <div className="px-6 pb-2 font-mono text-[10.5px] uppercase tracking-widest text-ink-300">
            Last refreshed · {lastUpdated}
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        {view === "kanban" ? (
          <KanbanBoard
            journalists={sortedJournalists}
            articlesByJournalist={articlesByJournalist}
          />
        ) : (
          <WeeklyList journalists={journalists} articles={articles} />
        )}
      </main>

      <footer className="px-6 py-4 font-mono text-[10.5px] uppercase tracking-widest text-ink-300">
        {journalists.length} journalists tracked · {articles.length} articles in view
      </footer>
    </div>
  );
}
