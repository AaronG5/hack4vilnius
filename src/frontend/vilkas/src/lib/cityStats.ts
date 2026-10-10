// Municipality view helpers derived from the resident problem model.
// TODO(api-gap): trend, reopened state and city KPIs should come from GET /stats/city.

import type { DistrictRow } from "../data/challengeMeta";
import type { ProblemView } from "./problemModel";

const DAY = 86_400_000;

export type Period = 7 | 30 | 0;

export const PERIODS: [Period, string][] = [
  [7, "Paskutinės 7 dienos"],
  [30, "Paskutinės 30 dienų"],
  [0, "Visas laikotarpis"],
];

export function inPeriod(v: ProblemView, period: Period, now = Date.now()): boolean {
  return period === 0 || now - v.created <= period * DAY;
}

/** Marked fixed, then residents said it was still there, and it isn't fixed since. */
export function isReopened(v: ProblemView): boolean {
  return !v.isFixed && Boolean(v.detail.reopened_at);
}

/** Rising when 2+ confirmations or urgency votes arrived in the last 3 days. */
export function trend(v: ProblemView, now = Date.now()): "up" | "flat" {
  const recent = v.detail.validations.filter((val) => val.is_valid && now - Date.parse(val.created_at) <= 3 * DAY).length;
  return recent >= 2 || (v.ageDays <= 3 && v.confirms >= 2) ? "up" : "flat";
}

/** Board 8 status column. */
export function cityStatus(v: ProblemView): string {
  if (isReopened(v)) return "Atidaryta iš naujo";
  switch (v.detail.status) {
    case "unconfirmed":
      return "Nepatvirtinta";
    case "confirmed":
      return "Nauja";
    case "ongoing":
      return "Priskirta";
    case "pending":
      return "Perduota";
    case "completed":
      return "Sutvarkyta";
    case "canceled":
      return "Atšaukta";
  }
}

/** Waiting for the city to assign an institution. */
export function needsAssignment(v: ProblemView): boolean {
  return v.detail.status === "confirmed" && !v.detail.institution;
}

/** Score badge tone: deep red ≥ 80, peach ≥ 50, lavender below. */
export function scoreTone(score: number): string {
  return score >= 80 ? "s-hi" : score >= 50 ? "s-mid" : "s-lo";
}

export function duplicatesMerged(v: ProblemView): number {
  return Math.max(0, v.detail.reports.length - 1);
}

/** District league: share of reports fixed, then volume. */
export function districtTable(views: ProblemView[], districts: string[]): DistrictRow[] {
  return districts
    .map((name) => {
      const rs = views.filter((v) => v.district === name);
      const fixed = rs.filter((v) => v.isFixed).length;
      return { name, total: rs.length, pct: rs.length ? Math.round((fixed / rs.length) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
}

// -- District dashboard (board 9) -------------------------------------------

export type Stage = "nep" | "pat" | "per" | "tvk" | "sut";

export const STAGES: { id: Stage; name: string; color: string }[] = [
  { id: "nep", name: "Nepatvirtinta", color: "#7E2324" },
  { id: "pat", name: "Patvirtinta", color: "var(--red)" },
  { id: "per", name: "Perduota vykdytojams", color: "var(--navy)" },
  { id: "tvk", name: "Tvarkoma", color: "var(--yellow)" },
  { id: "sut", name: "Sutvarkyta", color: "var(--green)" },
];

/** Where a problem is in the municipal pipeline right now. */
export function stageOf(v: ProblemView): Stage {
  switch (v.detail.status) {
    case "unconfirmed":
      return "nep";
    case "pending":
      return "per";
    case "ongoing":
      return "tvk";
    case "completed":
    case "canceled":
      return "sut";
    default:
      return "pat";
  }
}

export interface WeekBucket {
  start: number;
  views: ProblemView[];
  counts: Record<Stage, number>;
}

/** The last `n` 7-day windows ending today, oldest first. */
export function weekBuckets(views: ProblemView[], n = 8, now = Date.now()): WeekBucket[] {
  return Array.from({ length: n }, (_, i) => {
    const end = now - (n - 1 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const inWeek = views.filter((v) => v.created > start && v.created <= end);
    const counts: Record<Stage, number> = { nep: 0, pat: 0, per: 0, tvk: 0, sut: 0 };
    for (const v of inWeek) counts[stageOf(v)]++;
    return { start, views: inWeek, counts };
  });
}

/** Average days from report to being marked fixed. */
export function avgResolveDays(views: ProblemView[]): number | null {
  const done = views.filter((v) => v.isFixed);
  if (!done.length) return null;
  const total = done.reduce((n, v) => n + ((v.fixedAt ?? v.created) - v.created) / DAY, 0);
  return total / done.length;
}

/** Residents who reported or answered in these problems. */
export function activeResidents(views: ProblemView[]): number {
  const ids = new Set<string>();
  for (const v of views) {
    for (const r of v.detail.reports) ids.add(r.user.id);
    for (const val of v.detail.validations) ids.add(val.user.id);
  }
  return ids.size;
}

/** Round an axis maximum up to a friendly number (2, 4, 10, 20, 50…). */
export function niceMax(max: number): number {
  if (max <= 2) return 2;
  if (max <= 10) return Math.ceil(max / 2) * 2;
  return Math.ceil(max / 10) * 10;
}

/** "6,2" – Lithuanian decimal comma. */
export function decimal(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
