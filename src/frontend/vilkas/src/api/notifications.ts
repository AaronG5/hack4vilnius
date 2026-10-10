// Tag: notifications — per-user status change notifications.

import { request } from "./client";
import type { Notification, Uuid } from "./types";

/** GET /notifications — list the current user's notifications. */
export function listNotifications(signal?: AbortSignal): Promise<Notification[]> {
  return request<Notification[]>("/notifications", { signal });
}

/** PUT /notifications/{id}/read — mark a notification as read. */
export function markNotificationRead(id: Uuid, signal?: AbortSignal): Promise<Notification> {
  return request<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PUT",
    signal,
  });
}
