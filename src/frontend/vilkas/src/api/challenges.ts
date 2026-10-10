// Tag: challenges – city-created challenges.

import { request } from "./client";
import type { Challenge, ChallengeDetail, Leaderboard, Uuid } from "./types";

/** GET /challenges – list challenges. */
export function listChallenges(signal?: AbortSignal): Promise<Challenge[]> {
  return request<Challenge[]>("/challenges", { signal });
}

/** GET /challenges/{id} – challenge details (milestones, participants). */
export function getChallenge(id: Uuid, signal?: AbortSignal): Promise<ChallengeDetail> {
  return request<ChallengeDetail>(`/challenges/${encodeURIComponent(id)}`, { signal });
}

/** POST /challenges/{id}/join – join a challenge. */
export function joinChallenge(id: Uuid, signal?: AbortSignal): Promise<void> {
  return request<void>(`/challenges/${encodeURIComponent(id)}/join`, { method: "POST", signal });
}

/** DELETE /challenges/{id}/join – leave a challenge. */
export function leaveChallenge(id: Uuid, signal?: AbortSignal): Promise<void> {
  return request<void>(`/challenges/${encodeURIComponent(id)}/join`, { method: "DELETE", signal });
}

/** GET /leaderboard – residents ranked by points, city-wide or in one district. */
export function getLeaderboard(query: { district?: Uuid; limit?: number } = {}, signal?: AbortSignal): Promise<Leaderboard> {
  return request<Leaderboard>("/leaderboard", { query, signal });
}
