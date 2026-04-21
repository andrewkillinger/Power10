import type { Article, Journalist } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";

export function JournalistColumn({
  journalist,
  articles,
}: {
  journalist: Journalist;
  articles: Article[];
}) {
  return (
    <section
      className="flex h-full w-[300px] shrink-0 flex-col rounded-2xl bg-white/60
                 backdrop-blur-[2px] ring-1 ring-black/5"
    >
      <header className="sticky top-0 z-10 rounded-t-2xl border-b border-black/5
                         bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold leading-tight tracking-tight text-ink-900">
            {journalist.displayName}
          </h2>
          <span className="shrink-0 rounded-full bg-ink-100/70 px-2 py-0.5 text-[10px]
                           font-medium uppercase tracking-wider text-ink-500">
            {articles.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-500">{journalist.displayOutlet}</p>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2 scrollbar-thin">
        {articles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 px-3 py-6 text-center text-[11.5px] text-ink-300">
            No recent articles
          </div>
        ) : (
          articles.map((a) => <ArticleCard key={a.id} article={a} />)
        )}
      </div>
    </section>
  );
}
