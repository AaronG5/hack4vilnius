// Gamification derived from the user's own activity (reports and answers).

import landmarksData from "../data/landmarks.json";
import { distanceMeters, type LngLat } from "./geo";
import type { Activity } from "./problemModel";

/** The weekly goal, as the backend pays it (problems/rewards.py). */
export const WEEKLY_GOAL = 5;
export const WEEKLY_BONUS = 50;

/** Monday 00:00 of this week, local time (the backend uses Vilnius time). */
function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Answers given this week (Monday to Sunday) that proved right: the weekly goal's count. */
export function weekChecks(acts: Activity[], now = Date.now()): number {
  const start = weekStart(now);
  return acts.filter((a) => a.at >= start && a.type !== "report" && a.paid).length;
}

export interface Landmark {
  id: string;
  name: string;
  area: string;
  /** [longitude, latitude] */
  at: LngLat;
  /** SVG path in a 256×256 box. */
  d: string;
}

export const LANDMARKS = landmarksData as Landmark[];

const LANDMARK_REACH_M = 120;

/** Landmarks unlocked by reporting or answering within reach, with when. */
export function earnedLandmarks(acts: Activity[]): { landmark: Landmark; at: number }[] {
  const out: { landmark: Landmark; at: number }[] = [];
  for (const landmark of LANDMARKS) {
    const act = acts.find((a) => distanceMeters(a.where, landmark.at) <= LANDMARK_REACH_M);
    if (act) out.push({ landmark, at: act.at });
  }
  return out;
}

/** District of the latest action, as the demo uses for "your district"; "" before the first action. */
export function myDistrict(acts: Activity[], fallback = ""): string {
  for (let i = acts.length - 1; i >= 0; i--) if (acts[i].district) return acts[i].district;
  return fallback;
}

export function level(points: number): string {
  if (points >= 300) return "Rajono sargas";
  if (points >= 100) return "Aktyvus kaimynas";
  if (points >= 20) return "Pirmasis pranešėjas";
  return "Naujokas";
}
