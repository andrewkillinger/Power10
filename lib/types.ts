export type Journalist = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  outlets: string[];
  displayOutlet: string;
};

export type Article = {
  id: string;
  journalistId: string;
  outlet: string;
  headline: string;
  url: string;
  synopsis: string | null;
  publishedAt: string; // ISO timestamp
};

export type Freshness = "fresh" | "recent" | "stale";

export type SortMode =
  | "lastName"
  | "outlet"
  | "mostRecent"
  | "mostThisWeek";

export type ViewMode = "kanban" | "weekly";
