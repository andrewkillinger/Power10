import type { Article, Journalist, SortMode } from "./types";
import { isWithinLastWeek } from "./freshness";

export type ColumnSortContext = {
  articlesByJournalist: Map<string, Article[]>; // presorted newest-first
  now: Date;
};

/**
 * Return journalists ordered according to the requested sort mode.
 * All modes are stable; ties fall back to last-name alphabetical so the
 * board never re-shuffles arbitrarily between renders.
 */
export function sortJournalists(
  journalists: Journalist[],
  mode: SortMode,
  ctx: ColumnSortContext,
): Journalist[] {
  const byLastName = (a: Journalist, b: Journalist) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

  const arr = [...journalists];

  switch (mode) {
    case "lastName":
      return arr.sort(byLastName);

    case "outlet":
      return arr.sort(
        (a, b) => a.displayOutlet.localeCompare(b.displayOutlet) || byLastName(a, b),
      );

    case "mostRecent":
      return arr.sort((a, b) => {
        const ta = mostRecentTimestamp(ctx.articlesByJournalist.get(a.id));
        const tb = mostRecentTimestamp(ctx.articlesByJournalist.get(b.id));
        if (tb !== ta) return tb - ta;
        return byLastName(a, b);
      });

    case "mostThisWeek":
      return arr.sort((a, b) => {
        const ca = countThisWeek(ctx.articlesByJournalist.get(a.id), ctx.now);
        const cb = countThisWeek(ctx.articlesByJournalist.get(b.id), ctx.now);
        if (cb !== ca) return cb - ca;
        const ta = mostRecentTimestamp(ctx.articlesByJournalist.get(a.id));
        const tb = mostRecentTimestamp(ctx.articlesByJournalist.get(b.id));
        if (tb !== ta) return tb - ta;
        return byLastName(a, b);
      });
  }
}

function mostRecentTimestamp(articles: Article[] | undefined): number {
  if (!articles || articles.length === 0) return -Infinity;
  return new Date(articles[0].publishedAt).getTime();
}

function countThisWeek(articles: Article[] | undefined, now: Date): number {
  if (!articles) return 0;
  let n = 0;
  for (const a of articles) if (isWithinLastWeek(a.publishedAt, now)) n++;
  return n;
}

export function groupArticlesByJournalist(
  articles: Article[],
): Map<string, Article[]> {
  const map = new Map<string, Article[]>();
  for (const a of articles) {
    const list = map.get(a.journalistId);
    if (list) list.push(a);
    else map.set(a.journalistId, [a]);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }
  return map;
}
