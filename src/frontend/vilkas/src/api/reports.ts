// Tag: reports — user-submitted reports of problems.

import { request, toFormData } from "./client";
import type { Report, ReportCreate, Uuid } from "./types";

/** POST /reports — submit a new report (multipart: media + description). */
export function createReport(report: ReportCreate, signal?: AbortSignal): Promise<Report> {
  return request<Report>("/reports", {
    method: "POST",
    body: toFormData({
      description: report.description,
      category: report.category,
      problem: report.problem,
      media: report.media,
      // TODO(api-gap): extra fields not in openapi.yaml yet.
      title: report.title,
      address: report.address,
      location: report.location && JSON.stringify(report.location),
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
