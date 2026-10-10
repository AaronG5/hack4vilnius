// Tag: geocoding — turning a typed address into a location.

import { request } from "./client";
import type { Place } from "./types";

/** GET /geocode — places in Vilnius matching a typed address, best match first. */
export function searchPlaces(q: string, limit?: number, signal?: AbortSignal): Promise<Place[]> {
  return request<Place[]>("/geocode", { query: { q, limit }, signal });
}
