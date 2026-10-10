// Tags: problems, validations – reported city problems and their validations.

import { request, toFormData } from "./client";
import type {
  Problem,
  ProblemDetail,
  ProblemFilters,
  ProblemStatusUpdate,
  Uuid,
  Validation,
  ValidationCreate,
} from "./types";

/** GET /problems – list problems, filterable by status, urgency, district and category. */
export function listProblems(filters: ProblemFilters = {}, signal?: AbortSignal): Promise<Problem[]> {
  return request<Problem[]>("/problems", { query: filters, signal });
}

/** Query for GET /problems/nearby. */
export interface NearbyQuery {
  lat: number;
  lng: number;
  /** Category id: problems in it come first. */
  category?: Uuid;
  /** Metres, default 270. */
  radius?: number;
}

/** A problem near the point asked about, with its distance. */
export type NearbyProblem = Problem & { distance_m: number };

/** GET /problems/nearby – open problems around a point, same category first, then nearest. */
export function nearbyProblems(query: NearbyQuery, signal?: AbortSignal): Promise<NearbyProblem[]> {
  return request<NearbyProblem[]>("/problems/nearby", { query: { ...query }, signal });
}

/** GET /problems/{id} – problem details, including its reports and validations. */
export function getProblem(id: Uuid, signal?: AbortSignal): Promise<ProblemDetail> {
  return request<ProblemDetail>(`/problems/${encodeURIComponent(id)}`, { signal });
}

/** PUT /problems/{id}/status – admin/institution updates the problem status. */
export function updateProblemStatus(
  id: Uuid,
  update: ProblemStatusUpdate,
  signal?: AbortSignal,
): Promise<Problem> {
  return request<Problem>(`/problems/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: update,
    signal,
  });
}

/** GET /problems/{id}/validations – list validations for a problem. */
export function listProblemValidations(id: Uuid, signal?: AbortSignal): Promise<Validation[]> {
  return request<Validation[]>(`/problems/${encodeURIComponent(id)}/validations`, { signal });
}

/**
 * POST /problems/{id}/validations – submit a validation (multipart, with media).
 *
 * One answer per person per problem: a second one is refused with 409.
 */
export function createProblemValidation(
  id: Uuid,
  validation: ValidationCreate,
  signal?: AbortSignal,
): Promise<Validation> {
  return request<Validation>(`/problems/${encodeURIComponent(id)}/validations`, {
    method: "POST",
    body: toFormData({
      is_valid: validation.is_valid,
      description: validation.description,
      urgency: validation.urgency,
      media: validation.media,
    }),
    signal,
  });
}
