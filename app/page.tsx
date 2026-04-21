import { cookies } from "next/headers";
import { createClient, hasSupabaseEnv } from "@/utils/supabase/server";
import { DashboardShell } from "./_components/DashboardShell";
import { MOCK_ARTICLES, MOCK_JOURNALISTS } from "@/lib/mock";
import type { Article, Journalist } from "@/lib/types";

export const revalidate = 600; // refresh the page cache every 10 minutes

async function loadData(): Promise<{
  journalists: Journalist[];
  articles: Article[];
  usingMockData: boolean;
}> {
  if (!hasSupabaseEnv()) {
    return {
      journalists: MOCK_JOURNALISTS,
      articles: MOCK_ARTICLES,
      usingMockData: true,
    };
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const sixtyDaysAgo = new Date(
    Date.now() - 60 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [jRes, aRes] = await Promise.all([
    supabase
      .from("journalists")
      .select(
        "id, slug, first_name, last_name, display_name, outlets, display_outlet, sort_order",
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("articles")
      .select(
        "id, journalist_id, outlet, headline, url, synopsis, published_at",
      )
      .gte("published_at", sixtyDaysAgo)
      .order("published_at", { ascending: false })
      .limit(1500),
  ]);

  if (jRes.error || aRes.error || !jRes.data || !aRes.data) {
    console.error("Supabase load failed", { j: jRes.error, a: aRes.error });
    return {
      journalists: MOCK_JOURNALISTS,
      articles: MOCK_ARTICLES,
      usingMockData: true,
    };
  }

  const journalists: Journalist[] = jRes.data.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    firstName: r.first_name,
    lastName: r.last_name,
    displayName: r.display_name,
    outlets: r.outlets,
    displayOutlet: r.display_outlet,
  }));

  const articles: Article[] = aRes.data.map((r: any) => ({
    id: r.id,
    journalistId: r.journalist_id,
    outlet: r.outlet,
    headline: r.headline,
    url: r.url,
    synopsis: r.synopsis,
    publishedAt: r.published_at,
  }));

  return {
    journalists,
    articles,
    usingMockData: journalists.length === 0,
  };
}

export default async function Page() {
  const { journalists, articles, usingMockData } = await loadData();
  const lastUpdated = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <DashboardShell
      journalists={journalists}
      articles={articles}
      lastUpdated={lastUpdated}
      usingMockData={usingMockData}
    />
  );
}
