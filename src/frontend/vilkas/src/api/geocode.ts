// Tag: geocoding – turning a typed address into a location, and stops into a walk.

import { request } from "./client";
import type { Place } from "./types";

/** GET /geocode – places in Vilnius matching a typed address, best match first. */
export function searchPlaces(q: string, limit?: number, signal?: AbortSignal): Promise<Place[]> {
  return request<Place[]>("/geocode", { query: { q, limit }, signal });
}

/** A walk along streets and paths through stops, in their order. */
export interface WalkingRoute {
  distance_m: number;
  duration_s: number;
  /** GeoJSON LineString, `[longitude, latitude]` pairs. */
  path: { type: "LineString"; coordinates: [number, number][] };
  legs: { distance_m: number; duration_s: number }[];
}

/** GET /routes/walk – the walk through `stops` (`[longitude, latitude]`), 2 to 12 of them. */
export function walkingRoute(stops: [number, number][], signal?: AbortSignal): Promise<WalkingRoute> {
  const value = stops.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  return request<WalkingRoute>("/routes/walk", { query: { stops: value }, signal });
}
