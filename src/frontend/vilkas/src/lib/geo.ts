// Geographic helpers on [longitude, latitude] pairs (GeoJSON order).

import type { District } from "../api";

export type LngLat = [number, number];

/** Vilnius old town, for the initial map view. */
export const VILNIUS_CENTER: LngLat = [25.2797, 54.6872];

/** Distance in metres between two points (haversine). */
export function distanceMeters([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface Fix {
  at: LngLat;
  /** Radius of uncertainty in metres, as reported by the browser. */
  accuracy: number;
}

/** How close a resident must be to a problem to answer "still there?" — on site, geocaching-style. */
export const NEAR_RADIUS_M = 10;
// Phone GPS is often only good to 10–20 m, so a fix's own uncertainty counts in
// the resident's favour, up to this much; a vaguer fix can't prove they're there.
const MAX_ACCURACY_SLACK_M = 20;

/** Whether `fix` puts the device within `NEAR_RADIUS_M` of `at`. */
export function isNear(fix: Fix, at: LngLat): boolean {
  return distanceMeters(fix.at, at) - Math.min(fix.accuracy, MAX_ACCURACY_SLACK_M) <= NEAR_RADIUS_M;
}

/** The device's current position. Rejects with a `GeolocationPositionError`. */
export function currentPosition(): Promise<Fix> {
  return new Promise((resolve, reject: (reason: unknown) => void) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ at: [coords.longitude, coords.latitude], accuracy: coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

/** "30 m", "450 m", "1,2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(5, Math.round(meters / 5) * 5)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function inRing([x, y]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Centre of a district's bounding box (good enough for labels). */
export function districtCenter(d: District): LngLat {
  const ring = d.boundary.coordinates[0];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

/** District containing the point, else the one whose centre is nearest. */
export function districtOf(at: LngLat, districts: District[]): District | undefined {
  const hit = districts.find((d) => inRing(at, d.boundary.coordinates[0]));
  if (hit) return hit;
  let best: District | undefined;
  let bestDist = Infinity;
  for (const d of districts) {
    const dist = distanceMeters(at, districtCenter(d));
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}
