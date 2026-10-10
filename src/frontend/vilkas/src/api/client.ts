// Low-level HTTP client shared by all API modules.

import type { ApiErrorBody, AuthResponse } from "./types";

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

async function send<T>(path: string, options: RequestOptions): Promise<T> {
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

// A token the API doesn't know — left over from the mock API, or from a
// database that has since been reset — makes DRF reject *every* request with
// 401, the public endpoints included: it authenticates before it checks
// permissions. So a 401 on a request that carried a token means "this token is
// no good" rather than "you may not do this": drop it, start a fresh anonymous
// session and try once more.
const SESSION_PATHS = new Set(["/session", "/auth/login", "/auth/logout"]);

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const sentToken = getToken() !== null;
  try {
    return await send<T>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !sentToken || SESSION_PATHS.has(path)) {
      throw error;
    }
    await renewSession();
    return send<T>(path, options);
  }
}

/** POST /session — start an anonymous session and store its token. */
export async function createAnonymousSession(signal?: AbortSignal): Promise<AuthResponse> {
  // The stored token goes first: POST /session carrying an invalid one is itself a 401.
  setToken(null);
  const auth = await send<AuthResponse>("/session", { method: "POST", body: {}, signal });
  setToken(auth.token);
  return auth;
}

let pendingSession: Promise<void> | null = null;

/** Replace whatever token is stored with a new anonymous session. Concurrent calls share one request. */
export function renewSession(): Promise<void> {
  pendingSession ??= createAnonymousSession()
    .then(() => undefined)
    .finally(() => {
      pendingSession = null;
    });
  return pendingSession;
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
