// Tag: session — anonymous sessions and authentication.

import { getToken, request, setToken } from "./client";
import type { AuthResponse, LoginRequest } from "./types";

/** POST /session — create an anonymous session and store its token. */
export async function createSession(signal?: AbortSignal): Promise<AuthResponse> {
  const auth = await request<AuthResponse>("/session", { method: "POST", body: {}, signal });
  setToken(auth.token);
  return auth;
}

let pendingSession: Promise<void> | null = null;

/** Create an anonymous session unless a token is already stored. Concurrent calls share one request. */
export function ensureSession(): Promise<void> {
  if (getToken()) return Promise.resolve();
  pendingSession ??= createSession()
    .then(() => undefined)
    .finally(() => {
      pendingSession = null;
    });
  return pendingSession;
}

/** POST /auth/login — log in a registered user and store its token. */
export async function login(credentials: LoginRequest, signal?: AbortSignal): Promise<AuthResponse> {
  const auth = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: credentials,
    signal,
  });
  setToken(auth.token);
  return auth;
}

/** POST /auth/logout — end the current session and clear the stored token. */
export async function logout(signal?: AbortSignal): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST", signal });
  } finally {
    setToken(null);
  }
}
