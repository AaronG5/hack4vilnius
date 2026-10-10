// Phone-width column for the resident app; centered on wider screens.

import { Outlet } from "react-router-dom";
import "./AppShell.css";

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-shell__phone">
        <Outlet />
      </div>
    </div>
  );
}
