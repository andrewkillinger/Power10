// Minimal RSS / Atom parser that runs on Deno with zero external deps.
// Handles the two feed shapes we care about:
//   - RSS 2.0:  <rss><channel><item>...
//   - Atom:     <feed><entry>...
//
// Returns a normalized list of {title, link, summary, date} objects.

export type ParsedItem = {
  title: string;
  link: string;
  summary: string | null;
  date: string | null; // ISO 8601 or null
  author: string | null;
};

const decode = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

const stripHtml = (s: string): string =>
  decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const firstTag = (xml: string, tag: string): string | null => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : null;
};

const firstAttr = (xml: string, tag: string, attr: string): string | null => {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
};

const toIso = (s: string | null): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export function parseFeed(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // RSS 2.0 items
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    const title = firstTag(block, "title") ?? "";
    const link = firstTag(block, "link") ?? "";
    const pubDate = firstTag(block, "pubDate") ?? firstTag(block, "dc:date");
    const description = firstTag(block, "description") ?? firstTag(block, "content:encoded");
    const author =
      firstTag(block, "dc:creator") ??
      firstTag(block, "author") ??
      firstTag(block, "itunes:author");
    const cleanTitle = stripHtml(title);
    const cleanLink = stripHtml(link);
    if (!cleanTitle || !cleanLink) continue;
    items.push({
      title: cleanTitle,
      link: cleanLink,
      summary: description ? stripHtml(description) : null,
      date: toIso(pubDate),
      author: author ? stripHtml(author) : null,
    });
  }

  if (items.length > 0) return items;

  // Atom entries
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomEntries) {
    const title = firstTag(block, "title") ?? "";
    // <link href="..." /> or <link>...</link>
    const link = firstAttr(block, "link", "href") ?? firstTag(block, "link") ?? "";
    const date =
      firstTag(block, "updated") ??
      firstTag(block, "published") ??
      firstTag(block, "issued");
    const summary = firstTag(block, "summary") ?? firstTag(block, "content");
    const authorBlock = firstTag(block, "author");
    const author = authorBlock ? (firstTag(authorBlock, "name") ?? authorBlock) : null;
    const cleanTitle = stripHtml(title);
    const cleanLink = stripHtml(link);
    if (!cleanTitle || !cleanLink) continue;
    items.push({
      title: cleanTitle,
      link: cleanLink,
      summary: summary ? stripHtml(summary) : null,
      date: toIso(date),
      author: author ? stripHtml(author) : null,
    });
  }

  return items;
}

export function truncateSynopsis(s: string | null, max = 180): string | null {
  if (!s) return null;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
