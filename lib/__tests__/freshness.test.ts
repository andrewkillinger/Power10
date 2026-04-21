import { describe, it, expect } from "vitest";
import { getFreshness, isWithinLastWeek } from "../freshness";

const now = new Date("2026-04-21T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

describe("getFreshness", () => {
  it("returns fresh under 24h", () => {
    expect(getFreshness(hoursAgo(1), now)).toBe("fresh");
    expect(getFreshness(hoursAgo(23), now)).toBe("fresh");
  });

  it("returns recent between 24h and 7d", () => {
    expect(getFreshness(hoursAgo(25), now)).toBe("recent");
    expect(getFreshness(hoursAgo(24 * 6), now)).toBe("recent");
  });

  it("returns stale at or past 7 days", () => {
    expect(getFreshness(hoursAgo(24 * 8), now)).toBe("stale");
    expect(getFreshness(hoursAgo(24 * 30), now)).toBe("stale");
  });

  it("boundary exactly at 24h is recent", () => {
    expect(getFreshness(hoursAgo(24), now)).toBe("recent");
  });

  it("boundary exactly at 7d is stale", () => {
    expect(getFreshness(hoursAgo(24 * 7), now)).toBe("stale");
  });
});

describe("isWithinLastWeek", () => {
  it("includes anything under 7 days", () => {
    expect(isWithinLastWeek(hoursAgo(1), now)).toBe(true);
    expect(isWithinLastWeek(hoursAgo(24 * 6), now)).toBe(true);
  });
  it("excludes 7+ days", () => {
    expect(isWithinLastWeek(hoursAgo(24 * 7), now)).toBe(false);
    expect(isWithinLastWeek(hoursAgo(24 * 30), now)).toBe(false);
  });
});
