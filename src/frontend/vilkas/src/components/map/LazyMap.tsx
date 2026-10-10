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
        <i style={{ background: "var(--red-deep)", boxShadow: "0 0 0 3px rgba(126,35,36,.25)" }}>?</i>
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
      <span>
        <i style={{ background: "#9A9A9A" }} />
        Jūs atsakėte
      </span>
    </div>
  );
}
