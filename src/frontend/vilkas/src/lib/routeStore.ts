// The walk in progress: one per person, kept in this browser so it survives a
// reload mid-walk (a per-viewer convenience, so browser storage is the right place).

import { useSyncExternalStore } from "react";
import type { PlannedRoute } from "./routePlanner";

const KEY = "vilkas.route";
const listeners = new Set<() => void>();

function read(): PlannedRoute | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlannedRoute) : null;
  } catch {
    return null;
  }
}

let current: PlannedRoute | null = read();

export function setActiveRoute(route: PlannedRoute | null): void {
  current = route;
  try {
    if (route) localStorage.setItem(KEY, JSON.stringify(route));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): the route lasts for this page load.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActiveRoute(): PlannedRoute | null {
  return useSyncExternalStore(subscribe, () => current);
}
