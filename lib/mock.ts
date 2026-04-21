import type { Article, Journalist } from "./types";

/**
 * Fallback dataset used when Supabase env vars aren't configured yet
 * (e.g. local dev before `supabase link`, or a fresh Vercel preview).
 * Shape matches what getServerSupabase() returns from the real DB so
 * the UI code path is identical.
 */

const SLUG_TO_ID = (slug: string) =>
  `00000000-0000-0000-0000-${hash12(slug)}`;

function hash12(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  const hex = Math.abs(h).toString(16).padStart(12, "0").slice(0, 12);
  return hex;
}

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

export const MOCK_JOURNALISTS: Journalist[] = [
  { slug: "megan-morrone", firstName: "Megan", lastName: "Morrone", displayName: "Megan Morrone", outlets: ["Axios"], displayOutlet: "Axios" },
  { slug: "micah-ward", firstName: "Micah", lastName: "Ward", displayName: "Micah Ward", outlets: ["District Administration","University Business"], displayOutlet: "District Administration · University Business" },
  { slug: "alyson-klein", firstName: "Alyson", lastName: "Klein", displayName: "Alyson Klein", outlets: ["Education Week"], displayOutlet: "Education Week" },
  { slug: "alex-sarlin", firstName: "Alex", lastName: "Sarlin", displayName: "Alex Sarlin", outlets: ["Edtech Insiders"], displayOutlet: "Edtech Insiders (Substack)" },
  { slug: "laura-ascione", firstName: "Laura", lastName: "Ascione", displayName: "Laura Ascione", outlets: ["eSchool News","eSchool Media"], displayOutlet: "eSchool News · eSchool Media" },
  { slug: "kavitha-cardoza", firstName: "Kavitha", lastName: "Cardoza", displayName: "Kavitha Cardoza", outlets: ["The Hechinger Report"], displayOutlet: "The Hechinger Report" },
  { slug: "sabrina-ortiz", firstName: "Sabrina", lastName: "Ortiz", displayName: "Sabrina Ortiz", outlets: ["The Deep View"], displayOutlet: "The Deep View" },
  { slug: "ray-ravaglia", firstName: "Ray", lastName: "Ravaglia", displayName: "Ray Ravaglia", outlets: ["Forbes"], displayOutlet: "Forbes" },
  { slug: "lauren-coffey", firstName: "Lauren", lastName: "Coffey", displayName: "Lauren Coffey", outlets: ["EdSurge"], displayOutlet: "EdSurge" },
  { slug: "anna-merod", firstName: "Anna", lastName: "Merod", displayName: "Anna Merod", outlets: ["K-12 Dive"], displayOutlet: "K-12 Dive" },
  { slug: "daniel-mollenkamp", firstName: "Daniel", lastName: "Mollenkamp", displayName: "Daniel Mollenkamp", outlets: ["EdSurge"], displayOutlet: "EdSurge" },
].map((j) => ({ id: SLUG_TO_ID(j.slug), ...j }));

function jidBySlug(slug: string): string {
  const j = MOCK_JOURNALISTS.find((x) => x.slug === slug);
  if (!j) throw new Error(`mock journalist not found: ${slug}`);
  return j.id;
}

let counter = 0;
const a = (
  slug: string,
  outlet: string,
  headline: string,
  url: string,
  synopsis: string,
  h: number,
): Article => ({
  id: `mock-${++counter}`,
  journalistId: jidBySlug(slug),
  outlet,
  headline,
  url,
  synopsis,
  publishedAt: hoursAgo(h),
});

export const MOCK_ARTICLES: Article[] = [
  // fresh (< 24h)
  a("megan-morrone", "Axios", "Inside the agentic browser war",
    "https://www.axios.com/2026/04/21/agentic-browsers-arc-chrome",
    "A new wave of AI-native browsers is reframing how the web is consumed — and monetized.", 3),
  a("alex-sarlin", "Edtech Insiders", "The week in edtech deals",
    "https://edtechinsiders.substack.com/p/weekly-deals-apr",
    "Three term-sheet leaks, a $70M Series B, and what private capital is pricing in for 2026.", 7),
  a("lauren-coffey", "EdSurge", "Community colleges are quietly leading on AI",
    "https://www.edsurge.com/news/community-colleges-ai",
    "While flagships debate policy, two-year systems are shipping curriculum changes students actually see.", 14),
  a("anna-merod", "K-12 Dive", "Chronic absenteeism ticks down — unevenly",
    "https://www.k12dive.com/news/absenteeism-2026",
    "New state data suggests a fragile recovery concentrated in a handful of districts.", 20),
  a("kavitha-cardoza", "The Hechinger Report", "Inside one school's literacy reset",
    "https://hechingerreport.org/literacy-reset-2026",
    "A year after pivoting to structured literacy, early results show stubborn gaps for multilingual learners.", 22),

  // recent (1–7d)
  a("alyson-klein", "Education Week", "What a second Trump term means for Title I",
    "https://www.edweek.org/policy-politics/title-i-2026",
    "Appropriators are floating formulas that would reshuffle the program's largest stream in decades.", 50),
  a("micah-ward", "District Administration", "Superintendents flag cybersecurity gaps",
    "https://districtadministration.com/cybersecurity-2026",
    "Half of districts surveyed lack a full-time security hire as ransomware attempts climb.", 70),
  a("micah-ward", "University Business", "Endowment returns compress in Q1",
    "https://universitybusiness.com/endowments-q1-2026",
    "Mid-tier privates report the narrowest margins in five years — and deeper tuition-discount pressure.", 96),
  a("sabrina-ortiz", "The Deep View", "The quiet rise of on-device models",
    "https://www.thedeepview.com/p/on-device-models",
    "Why the next frontier for AI may be the phone in your pocket, not the hyperscaler data center.", 110),
  a("laura-ascione", "eSchool News", "IT leaders talk AI procurement pain",
    "https://www.eschoolnews.com/ai-procurement-2026",
    "Vendors are shipping faster than districts can evaluate; the gap is widening into a governance problem.", 130),
  a("ray-ravaglia", "Forbes", "What personalized learning still gets wrong",
    "https://www.forbes.com/sites/rayravaglia/2026/04/personalized-learning",
    "Two decades in, adaptive platforms still confuse engagement with mastery. Here's what good looks like.", 150),
  a("daniel-mollenkamp", "EdSurge", "Are schools underestimating pandemic-era losses for older students?",
    "https://www.edsurge.com/news/2026-01-09-are-schools-underestimating-how-badly-the-pandemic-hurt-older-k-12-students",
    "New research suggests high-school cohorts slipped further than early reads indicated — and recovery is slower.", 24 * 5),

  // stale (> 7d)
  a("megan-morrone", "Axios", "The data-center grid crunch",
    "https://www.axios.com/2026/04/10/data-centers-power",
    "Utilities are quietly warning regulators about AI load curves they can't meet.", 24 * 10),
  a("alex-sarlin", "Edtech Insiders", "Interview: a CEO on her post-ZIRP playbook",
    "https://edtechinsiders.substack.com/p/post-zirp",
    "A founder-to-founder conversation about rebuilding a company around durable retention.", 24 * 12),
  a("lauren-coffey", "EdSurge", "Inside a college's LMS replacement",
    "https://www.edsurge.com/news/lms-replacement",
    "Two years, four committees, one lesson: procurement is a people problem.", 24 * 15),
  a("kavitha-cardoza", "The Hechinger Report", "Rural districts, federal cliffs",
    "https://hechingerreport.org/rural-funding-cliff",
    "ESSER's end is landing hardest where substitutes are thinnest.", 24 * 22),
];
