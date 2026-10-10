// Shared by the resident app and the municipality pages: ensures a session exists
// and provides the shared app state. Children read the session status via useSession().

import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ensureSession, getToken } from "../api";
import { AppStateProvider } from "../state/AppStateProvider";
import type { SessionStatus } from "../state/session";

export function RootLayout() {
  const [ready, setReady] = useState(() => getToken() !== null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready) return;
    ensureSession().then(
      () => setReady(true),
      () => setFailed(true),
    );
  }, [ready]);

  return (
    <AppStateProvider ready={ready}>
      <Outlet context={{ ready, failed } satisfies SessionStatus} />
    </AppStateProvider>
  );
}
