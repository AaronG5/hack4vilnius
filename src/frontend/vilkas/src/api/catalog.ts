// Tags: categories, districts, badges — public reference data.

import { request } from "./client";
import type { Badge, Category, District } from "./types";

/** GET /categories — list available problem categories. */
export function listCategories(signal?: AbortSignal): Promise<Category[]> {
  return request<Category[]>("/categories", { signal });
}

/** GET /districts — list districts and their boundaries. */
export function listDistricts(signal?: AbortSignal): Promise<District[]> {
  return request<District[]>("/districts", { signal });
}

/** GET /badges — list all available badges. */
export function listBadges(signal?: AbortSignal): Promise<Badge[]> {
  return request<Badge[]>("/badges", { signal });
}
