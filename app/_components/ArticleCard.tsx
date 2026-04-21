import type { Article } from "@/lib/types";
import { getFreshness } from "@/lib/freshness";

function formatMeta(publishedAt: string, outlet: string): string {
  const d = new Date(publishedAt);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time} · ${outlet}`;
}

export function ArticleCard({ article }: { article: Article }) {
  const freshness = getFreshness(article.publishedAt);
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      data-freshness={freshness}
      className="group relative block overflow-hidden rounded-xl border shadow-card transition
                 hover:-translate-y-0.5 hover:shadow-cardHover focus-visible:outline
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-accent-vivid animate-fadeIn"
    >
      <span
        aria-hidden
        className="rail absolute left-0 top-0 h-full w-[3px]"
      />
      <div className="px-3 py-2.5 pl-4">
        <h3 className="headline text-[13.5px] font-semibold leading-snug text-ink-900 line-clamp-2">
          {article.headline}
        </h3>
        <div className="meta mt-1.5 font-mono text-[10.5px] uppercase tracking-wide">
          {formatMeta(article.publishedAt, article.outlet)}
        </div>
        {article.synopsis ? (
          <p className="synopsis mt-1.5 text-[11.5px] leading-snug text-ink-500 line-clamp-2">
            {article.synopsis}
          </p>
        ) : null}
      </div>
    </a>
  );
}
