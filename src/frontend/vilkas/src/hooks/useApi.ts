// Load data from an API function, cancelling the request on unmount or key change.

import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiState<T> {
  /** Last loaded value; kept while a reload is in flight. */
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  key: string;
  data?: T;
  error?: Error;
}

/**
 * @param load Called with an AbortSignal; may close over render values.
 * @param key  Reloads whenever it changes, e.g. `problem-${id}`.
 */
export function useApi<T>(load: (signal: AbortSignal) => Promise<T>, key: string): ApiState<T> {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [version, setVersion] = useState(0);
  const requestKey = `${key}#${version}`;
  const [result, setResult] = useState<Result<T>>({ key: "" });

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setResult((prev) => ({ key: requestKey, data: prev.data, error }));
      },
    );
    return () => controller.abort();
  }, [requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: result.data, error: result.error, loading: result.key !== requestKey, reload };
}
