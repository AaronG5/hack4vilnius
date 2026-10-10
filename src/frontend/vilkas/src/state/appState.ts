import { createContext, useContext } from "react";
import type { Category, District, Notification, User } from "../api";
import type { ProblemView } from "../lib/problemModel";

export type MapFilter = "all" | "new" | "work" | "fixed";

export interface AppState {
  me?: User;
  districts: District[];
  categories: Category[];
  views: ProblemView[];
  notifications: Notification[];
  /** Mark a notification read (optimistically). */
  markRead: (id: string) => Promise<void>;
  /** First load finished (successfully or not). */
  loaded: boolean;
  error?: Error;
  /** Reload problems and the current user (points). */
  reload: () => Promise<void>;
  filter: MapFilter;
  setFilter: (f: MapFilter) => void;
  toast: (message: string) => void;
  /** Current time, advanced every minute, so relative times and the fix window stay current. */
  clock: number;
}

export const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
