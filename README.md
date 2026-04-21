# Power10 — Journalist Desk

A professionally designed kanban dashboard that tracks recent articles from a
curated list of 11 education/tech journalists. One column per journalist, one
card per article. Cards are color-coded by freshness (vibrant under 24h, muted
under 7d, monochrome beyond that), link out to the source, and support four
column sort modes plus a "past week" text-list toggle.

```
┌─ Header ──────────────────────────────────────────────────────────────────┐
│ Journalist Desk · Power10     [Legend] [Kanban | This week · list] [Sort]│
├─ Board ───────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ …             │
│  │ Megan M.  │  │ Micah W.  │  │ Alyson K. │  │ Alex S.   │               │
│  │ Axios     │  │ DA · UB   │  │ Ed Week   │  │ Substack  │               │
│  │           │  │           │  │           │  │           │               │
│  │ ▌ fresh   │  │ ▌ recent  │  │ ░ stale   │  │ ▌ fresh   │               │
│  │ ▌ recent  │  │ ░ stale   │  │ ░ stale   │  │ ▌ recent  │               │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
└───────────────────────────────────────────────────────────────────────────┘
```

## Stack

- **Frontend:** Next.js 14 (App Router, React Server Components) · TypeScript · Tailwind CSS
- **Database:** Supabase (Postgres + RLS)
- **Ingestion:** Supabase Edge Function (Deno) parsing RSS where available, scraping HTML where not
- **Schedule:** `pg_cron` + `pg_net` hourly POST into the Edge Function
- **Hosting:** Vercel (frontend) · Supabase (database, function, scheduler)

## Journalists tracked (11)

| # | Journalist | Outlet(s) | Source kind |
|---|---|---|---|
| 1 | Megan Morrone | Axios | scrape |
| 2 | Micah Ward | District Administration · University Business | RSS × 2 |
| 3 | Alyson Klein | Education Week | scrape |
| 4 | Alex Sarlin | Edtech Insiders (Substack) | RSS |
| 5 | Laura Ascione | eSchool News · eSchool Media | RSS × 2 |
| 6 | Kavitha Cardoza | The Hechinger Report | RSS |
| 7 | Sabrina Ortiz | The Deep View | scrape |
| 8 | Ray Ravaglia | Forbes | RSS |
| 9 | Lauren Coffey | EdSurge | scrape |
| 10 | Anna Merod | K-12 Dive | scrape |
| 11 | Daniel Mollenkamp | EdSurge | scrape |

Scraper selectors live in `sources.selector` and can be edited in the DB
without redeploying — useful when an outlet changes its markup.

## Local development

```bash
# 1. install
npm install

# 2. run unit tests (freshness + sort logic)
npm test

# 3. start the dev server against sample data
npm run dev
# → http://localhost:3000 ("Sample data" badge appears until you wire Supabase)
```

The app ships with a mock dataset in `lib/mock.ts` that matches the live
schema, so the UI renders immediately without Supabase credentials.

## Connect Supabase

The app uses the official `@supabase/ssr` pattern (Next.js App Router) with
Supabase's new **publishable key** naming:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (starts with `sb_publishable_…`)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by the ingest function

Helpers live in:

- `utils/supabase/server.ts` — `createClient(cookieStore)` for RSC / route handlers
- `utils/supabase/client.ts` — `createClient()` for browser components
- `utils/supabase/middleware.ts` — session refresh, wired from `middleware.ts`

### Setup steps

1. Create a Supabase project (already done — `vpmvqzlcinfiwrfomthq`).
2. Copy `.env.example` → `.env.local` and fill in your URL + publishable key.
   (A `.env.local` is already provided with the project's values.)
3. Run the migrations:
   ```bash
   npx supabase link --project-ref vpmvqzlcinfiwrfomthq
   npx supabase db push
   ```
   This creates `journalists`, `sources`, `articles`, enables RLS, and seeds
   all 11 journalists with their source URLs.
4. Deploy the ingest function:
   ```bash
   npx supabase functions deploy ingest-articles
   ```
5. **Schedule the hourly cron via the Supabase Dashboard** (not SQL —
   managed Postgres blocks `alter database … set app.settings.*`):
   - Dashboard → **Database → Cron Jobs** → **"Create a new cron job"**
   - Name: `power10-ingest-hourly`
   - Schedule: `5 * * * *`
   - Type: **Supabase Edge Function**
   - Function: **ingest-articles**
   - Method: `POST`, Body: `{}`
   - Save.
6. Kick off the first ingestion run manually:
   ```bash
   npx supabase functions invoke ingest-articles --no-verify-jwt
   ```
   Then in SQL: `select count(*) from articles;` — you should see rows.

From this point the Dashboard cron job POSTs the function every hour
at `:05`.

## Deploy frontend (Vercel)

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL              # paste URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # paste sb_publishable_...
vercel --prod
```

The page is ISR-cached for 10 minutes (`revalidate = 600`) so the board stays
snappy even under load; cron-fresh articles appear within one revalidation
window.

## Design notes

- **Color bands** are driven entirely by a `data-freshness` attribute +
  Tailwind CSS in `app/globals.css`. No runtime color math.
  - `< 24h`  → indigo→fuchsia rail, white card, vibrant meta (the "fresh" band)
  - `< 7d`   → single-tone indigo rail, off-white card, muted meta
  - `≥ 7d`   → slate rail, slate-50 card, desaturated text
- **Typography**: Inter for UI, Fraunces serif for the page title and
  column headers — gives an editorial feel rather than a generic SaaS look.
- **Sort modes** (pure functions in `lib/sort.ts`, unit-tested):
  1. Most recent article (default — left = newest article anywhere)
  2. Most articles this week (left = most prolific in last 7d)
  3. Alphabetical · last name
  4. Alphabetical · outlet
- **Weekly list view** reuses the same dataset, filtered to the past 7 days
  and sorted reverse-chronologically. The sort dropdown is disabled in this
  view because it doesn't apply.

## File tour

```
app/
  layout.tsx                     root layout + font loading
  page.tsx                       RSC: loads data from Supabase (or mock)
  globals.css                    Tailwind + freshness color bands
  _components/
    DashboardShell.tsx           client: view + sort state
    KanbanBoard.tsx              horizontal scroll of columns
    JournalistColumn.tsx         column header + cards
    ArticleCard.tsx              compact card w/ freshness styling
    WeeklyList.tsx               text table, past 7 days
    SortDropdown.tsx             4-mode sort picker
    ViewToggle.tsx               Kanban ↔ Weekly
    FreshnessLegend.tsx          top-bar legend swatches
lib/
  types.ts                       Journalist, Article, SortMode, ViewMode, Freshness
  freshness.ts                   <24h / <7d / >=7d band logic
  sort.ts                        pure sort functions + grouping
  mock.ts                        sample dataset (fallback when no Supabase)
  __tests__/                     vitest
utils/supabase/
  server.ts                      createClient(cookieStore) for RSC
  client.ts                      createClient() for browser components
  middleware.ts                  session refresh helper
middleware.ts                    Next.js middleware entrypoint
supabase/
  migrations/
    0001_init.sql                tables + RLS
    0002_seed_journalists.sql    11 journalists + their sources
    0003_schedule_ingest.sql     pg_cron hourly POST to the function
  functions/ingest-articles/
    index.ts                     Deno entrypoint
    rss.ts                       zero-dep RSS/Atom parser
    scrape.ts                    deno-dom CSS-selector scraper
```

## Verifying end-to-end

```bash
npm test                         # freshness + sort unit tests (13 tests)
npm run build                    # typecheck + production build
npm run dev                      # renders sample data immediately
```

Once Supabase is wired:

```bash
npx supabase functions invoke ingest-articles --no-verify-jwt
# then in SQL editor:
select outlet, count(*), max(published_at)
from articles group by 1 order by 2 desc;
```
