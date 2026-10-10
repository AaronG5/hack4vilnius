// Low-level HTTP client shared by all API modules.

import type { ApiErrorBody } from "./types";

const TOKEN_STORAGE_KEY = "hack4vilnius.authToken";

interface ApiConfig {
  /** Base URL of the API, matching `servers[0].url` in openapi.yaml. */
  baseUrl: string;
}

const config: ApiConfig = {
  baseUrl: "/api",
};

/** Override client settings, e.g. `configureApi({ baseUrl: "http://127.0.0.1:8000/api" })`. */
export function configureApi(overrides: Partial<ApiConfig>): void {
  Object.assign(config, overrides);
}

// Storage access can throw (private mode, blocked site data), so it is guarded
// and falls back to an in-memory token.
let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token === null) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Ignore: the in-memory token still works for this page load.
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | unknown;

  constructor(status: number, body: ApiErrorBody | unknown) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as ApiErrorBody).detail)
        : `Request failed with status ${status}`;
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: object;
  /** Plain objects are sent as JSON; FormData is sent as multipart/form-data. */
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: object): string {
  let url = `${config.baseUrl}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const search = params.toString();
    if (search) {
      url += `?${search}`;
    }
  }
  return url;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  const token = getToken();
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Let the browser set the multipart boundary.
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: payload,
    signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data as T;
}

/** Build multipart form data, appending each array item under the same key. */
export function toFormData(fields: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      continue;
    }
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      form.append(key, item instanceof Blob ? item : String(item));
    }
  }
  return form;
}
