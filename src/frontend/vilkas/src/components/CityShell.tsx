// Desktop layout for the municipality pages.

import { Outlet } from "react-router-dom";
import "./CityShell.css";

export function CityShell() {
  return (
    <div className="city-shell">
      <Outlet />
    </div>
  );
}
