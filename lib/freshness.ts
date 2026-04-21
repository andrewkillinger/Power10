import type { Freshness } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function getFreshness(publishedAt: string | Date, now: Date = new Date()): Freshness {
  const t = typeof publishedAt === "string" ? new Date(publishedAt).getTime() : publishedAt.getTime();
  const age = now.getTime() - t;
  if (age < DAY) return "fresh";
  if (age < WEEK) return "recent";
  return "stale";
}

export function isWithinLastWeek(publishedAt: string | Date, now: Date = new Date()): boolean {
  const t = typeof publishedAt === "string" ? new Date(publishedAt).getTime() : publishedAt.getTime();
  return now.getTime() - t < WEEK;
}
