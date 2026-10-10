// Live device position for "validate only on site": a geolocation watch that
// starts on its own when the browser already allows location, and otherwise
// on a tap (browsers want a user gesture before asking for permission).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Fix } from "./geo";

export interface WatchedFix {
  /** Latest position, or undefined until the first fix arrives. */
  fix?: Fix;
  /** True once watching was asked for (permission prompt or fixes pending). */
  watching: boolean;
  /** Set when location is refused or unavailable. */
  error?: string;
  /** Start watching; call from a click so the permission prompt can show. */
  start: () => void;
}

function message(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Vietos nustatymas išjungtas – leiskite jį naršyklės nustatymuose.";
  if (err.code === err.TIMEOUT) return "Vieta nustatoma per ilgai – pabandykite dar kartą.";
  return "Nepavyko nustatyti vietos.";
}

export function useWatchedFix(): WatchedFix {
  const [fix, setFix] = useState<Fix>();
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string>();
  const id = useRef<number | null>(null);

  const start = useCallback(() => {
    if (id.current !== null) return;
    if (!navigator.geolocation) {
      setError("Šis įrenginys nenustato vietos.");
      return;
    }
    setWatching(true);
    setError(undefined);
    id.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setFix({ at: [coords.longitude, coords.latitude], accuracy: coords.accuracy });
        setError(undefined);
      },
      (err) => {
        setError(message(err));
        if (err.code === err.PERMISSION_DENIED && id.current !== null) {
          navigator.geolocation.clearWatch(id.current);
          id.current = null;
          setWatching(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, []);

  // Already allowed: no prompt will show, so start without waiting for a tap.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (!cancelled && status.state === "granted") start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (id.current !== null) navigator.geolocation.clearWatch(id.current);
      id.current = null;
    };
  }, [start]);

  return { fix, watching, error, start };
}
