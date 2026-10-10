// Loads MapLibre on demand; shows a same-size placeholder meanwhile.

import { lazy, Suspense } from "react";
import type { VilniusMapProps } from "./VilniusMap";
import "./map.css";

const VilniusMap = lazy(() => import("./VilniusMap"));

export function LazyMap(props: VilniusMapProps) {
  return (
    <Suspense fallback={<div className="vmap vmap-loading" style={{ height: props.height }} aria-label="Įkeliamas žemėlapis" />}>
      <VilniusMap {...props} />
    </Suspense>
  );
}

export function MapLegend() {
  return (
    <div className="legend" aria-label="Žymių reikšmės">
      <span>
        <i style={{ background: "rgba(237,28,36,.45)", boxShadow: "0 0 0 3px rgba(237,28,36,.2)" }}>?</i>
        Nepatvirtinta
      </span>
      <span>
        <i style={{ background: "var(--red)" }} />
        Patvirtinta
      </span>
      <span>
        <i style={{ background: "var(--yellow)" }} />
        Sprendžiama
      </span>
      <span>
        <i style={{ background: "var(--green)" }} />
        Sutvarkyta
      </span>
    </div>
  );
}
