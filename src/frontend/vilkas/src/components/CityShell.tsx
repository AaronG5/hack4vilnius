// Desktop layout for the municipality pages (design boards 8–10).
// TODO(api-gap): no city-staff login yet; the pages use the anonymous session.

import { Outlet } from "react-router-dom";
import { useAppState } from "../state/appState";
import { useSession } from "../state/session";
import "./CityShell.css";

export function CityShell() {
  const { ready, failed } = useSession();
  const { loaded } = useAppState();

  return (
    <div className="city-shell">
      <div className="city-wrap">
        {failed ? (
          <div className="ccard empty" role="alert">
            Nepavyko prisijungti prie serverio.
          </div>
        ) : ready && loaded ? (
          <Outlet />
        ) : (
          <div className="ccard empty">Įkeliama…</div>
        )}
      </div>
    </div>
  );
}
