// Tag: users – the current user's profile and badges.

import { request } from "./client";
import type { EarnedBadge, User, UserUpdate } from "./types";

/** GET /users/me – current user's profile, points and trust score. */
export function getCurrentUser(signal?: AbortSignal): Promise<User> {
  return request<User>("/users/me", { signal });
}

/** PUT /users/me – update profile fields. */
export function updateCurrentUser(update: UserUpdate, signal?: AbortSignal): Promise<User> {
  return request<User>("/users/me", { method: "PUT", body: update, signal });
}

/** GET /users/me/badges – badges earned by the current user. */
export function getCurrentUserBadges(signal?: AbortSignal): Promise<EarnedBadge[]> {
  return request<EarnedBadge[]>("/users/me/badges", { signal });
}
