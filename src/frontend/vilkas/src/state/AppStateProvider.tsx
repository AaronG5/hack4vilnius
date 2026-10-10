// Loads the data every resident screen shares and exposes it through AppStateContext.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getCurrentUser,
  getProblem,
  listCategories,
  listDistricts,
  listProblems,
  type Category,
  type District,
  type ProblemDetail,
  type User,
} from "../api";
import { earnedLandmarks } from "../lib/activity";
import { myActivity, toView } from "../lib/problemModel";
import { AppStateContext, type MapFilter } from "./appState";

const TOAST_MS = 2600;

export function AppStateProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [me, setMe] = useState<User>();
  const [districts, setDistricts] = useState<District[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [details, setDetails] = useState<ProblemDetail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error>();
  const [filter, setFilter] = useState<MapFilter>("all");
  const [toastMessage, setToastMessage] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // TODO(api-gap): GET /problems lacks list summaries, so details are fetched per problem.
  const reload = useCallback(async () => {
    try {
      const [user, problems] = await Promise.all([getCurrentUser(), listProblems()]);
      const full = await Promise.all(problems.map((p) => getProblem(p.id)));
      setMe(user);
      setDetails(full);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    Promise.all([listDistricts(), listCategories()])
      .then(([d, c]) => {
        setDistricts(d);
        setCategories(c);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err : new Error(String(err))))
      .then(reload)
      .finally(() => setLoaded(true));
  }, [ready, reload]);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(undefined), TOAST_MS);
  }, []);

  const views = useMemo(
    () => details.filter((p) => p.status !== "canceled").map((p) => toView(p, me?.id, districts)),
    [details, me?.id, districts],
  );

  // Announce landmarks unlocked since the last load (after the action's own toast).
  const earnedIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!me) return;
    const earned = earnedLandmarks(myActivity(views, me.id));
    const before = earnedIds.current;
    earnedIds.current = new Set(earned.map((e) => e.landmark.id));
    if (!before) return;
    const fresh = earned.filter((e) => !before.has(e.landmark.id));
    if (!fresh.length) return;
    const t = setTimeout(() => toast(`Naujas ženklelis: ${fresh.map((e) => e.landmark.name).join(", ")}!`), 2700);
    return () => clearTimeout(t);
  }, [views, me, toast]);

  const value = useMemo(
    () => ({ me, districts, categories, views, loaded, error, reload, filter, setFilter, toast }),
    [me, districts, categories, views, loaded, error, reload, filter, toast],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite">
        {toastMessage && <div className="toast">{toastMessage}</div>}
      </div>
    </AppStateContext.Provider>
  );
}
