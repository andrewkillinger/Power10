// Lightweight HTML scraping for non-RSS sources. Uses deno-dom (native to
// Supabase Edge Functions) so we get real DOM querying without a bundler.
//
// The `selector` JSON stored in the `sources` table has this shape:
//   {
//     "item":    "article",               // repeated elements to scrape
//     "title":   "h2 a",                  // CSS selector within each item
//     "link":    "h2 a@href",             // "<selector>@<attr>" -> attribute
//     "date":    "time@datetime",         // same; date is ISO-ish
//     "summary": "p.dek"                  // optional
//   }
//
// Per-site selectors intentionally list multiple alternatives separated by
// commas (CSS OR) so one stored pattern can tolerate minor layout changes.

import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.46/deno-dom-wasm.ts";
import { truncateSynopsis, type ParsedItem } from "./rss.ts";

// A realistic desktop-Chrome identity. Sites like Axios and K-12 Dive
// aggressively 403 anything that looks like a bot, so we pass the full
// set of headers a normal browser would send.
export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Ch-Ua": '"Chromium";v="129", "Not=A?Brand";v="8", "Google Chrome";v="129"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export type ScrapeSelectors = {
  item: string;
  title: string;
  link: string;
  date?: string;
  summary?: string;
};

function splitSelector(s: string): { css: string; attr: string | null } {
  const at = s.lastIndexOf("@");
  if (at === -1) return { css: s, attr: null };
  return { css: s.slice(0, at), attr: s.slice(at + 1) };
}

function queryFirstValue(
  root: Element,
  selector: string,
  fallbackToRoot = false,
): string | null {
  const { css, attr } = splitSelector(selector);
  // Try each comma-separated alternative in order.
  for (const variant of css.split(",").map((x) => x.trim()).filter(Boolean)) {
    let el: Element | null = null;
    if (variant === "self") {
      el = root;
    } else {
      el = root.querySelector(variant) as Element | null;
    }
    if (!el && fallbackToRoot && variant === css.split(",")[0].trim()) {
      el = root;
    }
    if (!el) continue;
    if (attr) {
      const v = el.getAttribute(attr);
      if (v) return v.trim();
    } else {
      const t = el.textContent?.trim();
      if (t) return t;
    }
  }
  return null;
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export async function scrapeSource(
  url: string,
  selectors: ScrapeSelectors,
): Promise<ParsedItem[]> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`scrape ${url} → HTTP ${res.status}`);
  }
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error(`could not parse HTML for ${url}`);

  const items: ParsedItem[] = [];
  const seen = new Set<string>();

  // Iterate each alternative in `selectors.item` until one yields results.
  for (const itemCss of selectors.item.split(",").map((x) => x.trim()).filter(Boolean)) {
    const nodes = Array.from(doc.querySelectorAll(itemCss)) as Element[];
    if (nodes.length === 0) continue;

    for (const node of nodes) {
      const title = queryFirstValue(node, selectors.title);
      let link = queryFirstValue(node, selectors.link);
      if (!title || !link) continue;

      link = absolutize(link, url);
      if (seen.has(link)) continue;
      seen.add(link);

      const date = selectors.date ? queryFirstValue(node, selectors.date) : null;
      const summary = selectors.summary
        ? queryFirstValue(node, selectors.summary)
        : null;

      items.push({
        title,
        link,
        summary: truncateSynopsis(summary),
        date: date ? normalizeDate(date) : null,
      });
    }
    if (items.length > 0) break;
  }

  return items;
}

function normalizeDate(s: string): string | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
