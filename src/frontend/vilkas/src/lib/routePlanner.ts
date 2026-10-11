// Route planner: a walk through the closest problems, within a time budget.
// Picks the stops and their order here (all problems are already loaded); the
// backend's /routes/walk then turns them into a street path.
//
// How stops are chosen:
// - Every open problem this person can still answer: not fixed, not being
//   fixed by the city, not their own, not already answered.
// - Nearest first: from where you are, the next stop is the closest one, as
//   long as walking there (plus a couple of minutes to look and answer) still
//   fits in the time chosen.
// - Then a 2-opt pass removes crossings, so the walk doesn't zig-zag.
// Walking time is estimated from straight-line distance × DETOUR at WALK_SPEED;
// the backend's real path replaces the estimate once it arrives.

import { distanceMeters, type LngLat } from "./geo";
import type { ProblemView } from "./problemModel";

export const DURATIONS = [15, 30, 60] as const;

/** Walking speed, metres per minute (4.5 km/h). */
const WALK_SPEED = 75;
/** Streets are longer than a straight line: a typical city detour factor. */
const DETOUR = 1.3;
/** Minutes at each stop to look, take a photo and answer. */
const STOP_MINUTES = 2;
/** Google Maps takes up to 9 waypoints; 8 stops also keeps a walk focused. */
export const MAX_STOPS = 8;

export interface RouteStop {
  id: string;
  at: LngLat;
  title: string;
  category: string;
  score: number;
}

export interface PlannedRoute {
  minutes: number;
  start: LngLat;
  stops: RouteStop[];
  /** Street path from start through the stops; straight lines if the router was unavailable. */
  path: LngLat[];
  /** True when `path` follows streets (from the backend), false for straight lines. */
  onStreets: boolean;
  distanceM: number;
  durationS: number;
  createdAt: number;
}

/** Problems this person could check on a walk. */
export function candidates(views: ProblemView[]): ProblemView[] {
  return views.filter((v) => !v.isFixed && v.status !== "work" && !v.mine && v.myVote === undefined);
}

/** Estimated minutes to walk between two points. */
function walkMinutes(a: LngLat, b: LngLat): number {
  return (distanceMeters(a, b) * DETOUR) / WALK_SPEED;
}

function pathMinutes(start: LngLat, stops: RouteStop[]): number {
  let total = 0;
  let here = start;
  for (const s of stops) {
    total += walkMinutes(here, s.at) + STOP_MINUTES;
    here = s.at;
  }
  return total;
}

/** Reverse segments while that shortens the walk (start stays first, the end is free). */
function twoOpt(start: LngLat, stops: RouteStop[]): RouteStop[] {
  let best = stops;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const next = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        if (pathMinutes(start, next) + 1e-9 < pathMinutes(start, best)) {
          best = next;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Choose and order the stops for a walk of about `minutes` from `start`. */
export function planStops(views: ProblemView[], start: LngLat, minutes: number): RouteStop[] {
  const pool: RouteStop[] = candidates(views).map((v) => ({ id: v.id, at: v.at, title: v.title, category: v.category, score: v.score }));
  const chosen: RouteStop[] = [];
  let here = start;
  let used = 0;
  while (chosen.length < MAX_STOPS) {
    let pick: { stop: RouteStop; cost: number } | undefined;
    for (const stop of pool) {
      if (chosen.includes(stop)) continue;
      const cost = walkMinutes(here, stop.at) + STOP_MINUTES;
      if (used + cost > minutes) continue;
      if (!pick || cost < pick.cost) pick = { stop, cost };
    }
    if (!pick) break;
    chosen.push(pick.stop);
    used += pick.cost;
    here = pick.stop.at;
  }
  return twoOpt(start, chosen);
}

/** Straight-line estimate for a planned walk, used until (or instead of) the street path. */
export function estimate(start: LngLat, stops: RouteStop[]): { distanceM: number; durationS: number } {
  let metres = 0;
  let here = start;
  for (const s of stops) {
    metres += distanceMeters(here, s.at) * DETOUR;
    here = s.at;
  }
  return { distanceM: metres, durationS: (metres / WALK_SPEED) * 60 };
}

/** Google Maps walking directions through the stops (opens the app on phones). */
export function googleMapsUrl(start: LngLat, stops: RouteStop[]): string {
  const ll = ([lng, lat]: LngLat) => `${lat},${lng}`;
  const last = stops[stops.length - 1];
  const params = new URLSearchParams({ api: "1", origin: ll(start), destination: ll(last.at), travelmode: "walking" });
  const via = stops.slice(0, -1).map((s) => ll(s.at));
  if (via.length) params.set("waypoints", via.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** "1,2 km · ~18 min" */
export function routeSummary(distanceM: number, durationS: number, stops: number): string {
  const km = (distanceM / 1000).toFixed(1).replace(".", ",");
  const min = Math.max(1, Math.round(durationS / 60 + stops * STOP_MINUTES));
  return `${km} km · ~${min} min`;
}
