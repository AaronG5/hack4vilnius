// Tag: reports — user-submitted reports of problems.

import { request, toFormData } from "./client";
import type { Report, ReportCreate, Uuid } from "./types";

/** POST /reports — submit a new report (multipart: media + description). */
export function createReport(report: ReportCreate, signal?: AbortSignal): Promise<Report> {
  // Flat latitude/longitude rather than a GeoPoint: the body is multipart/form-data.
  const [longitude, latitude] = report.location?.coordinates ?? [];
  return request<Report>("/reports", {
    method: "POST",
    body: toFormData({
      description: report.description,
      category: report.category,
      problem: report.problem,
      latitude,
      longitude,
      media: report.media,
      // TODO(api-gap): extra fields not in openapi.yaml yet; the backend ignores them.
      title: report.title,
      address: report.address,
      urgency: report.urgency,
      near_sensitive: report.near_sensitive,
    }),
    signal,
  });
}

/** GET /reports/{id} — report details. */
export function getReport(id: Uuid, signal?: AbortSignal): Promise<Report> {
  return request<Report>(`/reports/${encodeURIComponent(id)}`, { signal });
}
