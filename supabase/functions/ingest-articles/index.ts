// Hourly ingestion job — fetches each `sources` row, upserts into `articles`.
//
// Invoked three ways:
//   1. pg_cron (migration 0003) → pg_net POST → this function (production)
//   2. `supabase functions invoke ingest-articles` (dev smoke test)
//   3. Manual HTTP POST from a local script
//
// RLS is bypassed via the service-role key (SUPABASE_SERVICE_ROLE_KEY).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parseFeed, truncateSynopsis, type ParsedItem } from "./rss.ts";
import { scrapeSource, type ScrapeSelectors } from "./scrape.ts";

type SourceRow = {
  id: string;
  journalist_id: string;
  outlet: string;
  kind: "rss" | "scrape";
  url: string;
  selector: ScrapeSelectors | null;
  enabled: boolean;
};

type ArticleRow = {
  journalist_id: string;
  outlet: string;
  headline: string;
  url: string;
  synopsis: string | null;
  published_at: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_SOURCE = 20;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function fetchRss(url: string): Promise<ParsedItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Power10Bot/1.0; +https://power10.app)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) throw new Error(`rss ${url} → HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml);
}

function normalizeToArticleRows(
  items: ParsedItem[],
  src: SourceRow,
): ArticleRow[] {
  const rows: ArticleRow[] = [];
  for (const it of items.slice(0, MAX_PER_SOURCE)) {
    if (!it.title || !it.link) continue;
    // published_at is required in the schema; skip items missing a date.
    if (!it.date) continue;
    rows.push({
      journalist_id: src.journalist_id,
      outlet: src.outlet,
      headline: it.title,
      url: it.link,
      synopsis: truncateSynopsis(it.summary),
      published_at: it.date,
    });
  }
  return rows;
}

async function ingestOne(src: SourceRow): Promise<{ inserted: number; error?: string }> {
  try {
    let items: ParsedItem[] = [];
    if (src.kind === "rss") {
      items = await fetchRss(src.url);
    } else {
      if (!src.selector) throw new Error("scrape source missing selector");
      items = await scrapeSource(src.url, src.selector);
    }
    const rows = normalizeToArticleRows(items, src);
    if (rows.length === 0) return { inserted: 0 };
    const { error } = await admin
      .from("articles")
      .upsert(rows, { onConflict: "journalist_id,url", ignoreDuplicates: false });
    if (error) throw error;
    return { inserted: rows.length };
  } catch (err) {
    return { inserted: 0, error: String(err) };
  }
}

Deno.serve(async () => {
  const start = Date.now();
  const { data: sources, error } = await admin
    .from("sources")
    .select("id, journalist_id, outlet, kind, url, selector, enabled")
    .eq("enabled", true);
  if (error || !sources) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const results: Record<string, { inserted: number; error?: string }> = {};
  let totalInserted = 0;
  let totalErrors = 0;

  // Run sources with modest parallelism (4 at a time) to be polite.
  const queue = [...sources] as SourceRow[];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const src = queue.shift();
      if (!src) return;
      const r = await ingestOne(src);
      results[`${src.outlet}:${src.url}`] = r;
      totalInserted += r.inserted;
      if (r.error) totalErrors++;
      console.log(
        `ingest ${src.kind} ${src.outlet} ← ${src.url} :: inserted=${r.inserted}${r.error ? ` error=${r.error}` : ""}`,
      );
    }
  });
  await Promise.all(workers);

  return new Response(
    JSON.stringify({
      ok: true,
      ms: Date.now() - start,
      total_inserted: totalInserted,
      total_errors: totalErrors,
      results,
    }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
});
