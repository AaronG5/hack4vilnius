// Tag: moderation – staff review of flagged reports.

import { request } from "./client";
import type { ModerationFlag, ModerationFlagUpdate, Uuid } from "./types";

/** GET /moderation/flags – list flagged reports pending review. */
export function listModerationFlags(signal?: AbortSignal): Promise<ModerationFlag[]> {
  return request<ModerationFlag[]>("/moderation/flags", { signal });
}

/** PUT /moderation/flags/{id} – approve or dismiss a flag. */
export function updateModerationFlag(
  id: Uuid,
  update: ModerationFlagUpdate,
  signal?: AbortSignal,
): Promise<ModerationFlag> {
  return request<ModerationFlag>(`/moderation/flags/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: update,
    signal,
  });
}
