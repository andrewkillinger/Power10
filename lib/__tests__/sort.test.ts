import { describe, it, expect } from "vitest";
import { groupArticlesByJournalist, sortJournalists } from "../sort";
import type { Article, Journalist } from "../types";

const j = (id: string, first: string, last: string, outlet: string): Journalist => ({
  id,
  slug: last.toLowerCase(),
  firstName: first,
  lastName: last,
  displayName: `${first} ${last}`,
  outlets: [outlet],
  displayOutlet: outlet,
});

const a = (
  journalistId: string,
  hoursAgo: number,
  now: Date,
  headline = "x",
): Article => ({
  id: `${journalistId}-${hoursAgo}`,
  journalistId,
  outlet: "X",
  headline,
  url: `https://example.com/${journalistId}-${hoursAgo}`,
  synopsis: null,
  publishedAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
});

const now = new Date("2026-04-21T12:00:00Z");

const ada = j("ada", "Ada", "Lovelace", "Zeta Outlet");
const bob = j("bob", "Bob", "Banner", "Alpha Outlet");
const cara = j("cara", "Cara", "Coyne", "Mu Outlet");

describe("sortJournalists", () => {
  it("sorts by last name", () => {
    const sorted = sortJournalists([ada, bob, cara], "lastName", {
      articlesByJournalist: new Map(),
      now,
    });
    expect(sorted.map((x) => x.lastName)).toEqual(["Banner", "Coyne", "Lovelace"]);
  });

  it("sorts by outlet alphabetically", () => {
    const sorted = sortJournalists([ada, bob, cara], "outlet", {
      articlesByJournalist: new Map(),
      now,
    });
    expect(sorted.map((x) => x.displayOutlet)).toEqual([
      "Alpha Outlet",
      "Mu Outlet",
      "Zeta Outlet",
    ]);
  });

  it("sorts by most recent article (left = newest)", () => {
    const articles = [
      a("ada", 48, now), // 2d ago
      a("bob", 2, now), // 2h ago — newest
      a("cara", 24 * 10, now), // 10d ago
    ];
    const map = groupArticlesByJournalist(articles);
    const sorted = sortJournalists([ada, bob, cara], "mostRecent", {
      articlesByJournalist: map,
      now,
    });
    expect(sorted.map((x) => x.id)).toEqual(["bob", "ada", "cara"]);
  });

  it("sorts by most articles this week (left = most)", () => {
    const articles = [
      // bob: 3 this week
      a("bob", 2, now),
      a("bob", 48, now),
      a("bob", 24 * 5, now),
      // ada: 1 this week, 1 old
      a("ada", 12, now),
      a("ada", 24 * 30, now),
      // cara: 2 this week
      a("cara", 24, now),
      a("cara", 48, now),
    ];
    const map = groupArticlesByJournalist(articles);
    const sorted = sortJournalists([ada, bob, cara], "mostThisWeek", {
      articlesByJournalist: map,
      now,
    });
    expect(sorted.map((x) => x.id)).toEqual(["bob", "cara", "ada"]);
  });

  it("falls back to last name on ties", () => {
    const sorted = sortJournalists([cara, bob, ada], "mostThisWeek", {
      articlesByJournalist: new Map(),
      now,
    });
    // all have 0 articles — pure last-name order
    expect(sorted.map((x) => x.lastName)).toEqual(["Banner", "Coyne", "Lovelace"]);
  });
});

describe("groupArticlesByJournalist", () => {
  it("groups and sorts newest-first per journalist", () => {
    const arts = [
      a("ada", 10, now),
      a("ada", 1, now),
      a("ada", 50, now),
      a("bob", 3, now),
    ];
    const map = groupArticlesByJournalist(arts);
    const adaArts = map.get("ada")!;
    const adaAges = adaArts.map((x) =>
      (now.getTime() - new Date(x.publishedAt).getTime()) / (60 * 60 * 1000),
    );
    expect(adaAges).toEqual([1, 10, 50]);
    expect(map.get("bob")!.length).toBe(1);
  });
});
