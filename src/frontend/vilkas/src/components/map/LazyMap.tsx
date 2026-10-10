// Loads MapLibre on demand; shows a same-size placeholder meanwhile.

import { lazy, Suspense } from "react";
import type { VilniusMapProps } from "./VilniusMap";
import { MARKS, type MarkKind } from "./marks";
import "./map.css";

const VilniusMap = lazy(() => import("./VilniusMap"));

export function LazyMap(props: VilniusMapProps) {
  return (
    <Suspense fallback={<div className="vmap vmap-loading" style={{ height: props.height }} aria-label="Įkeliamas žemėlapis" />}>
      <VilniusMap {...props} />
    </Suspense>
  );
}

const LEGEND: [MarkKind, string][] = [
  ["new", "Nepatvirtinta"],
  ["confirmed", "Patvirtinta"],
  ["work", "Sprendžiama"],
  ["fixed", "Sutvarkyta"],
  ["checked", "Jūs atsakėte"],
];

export function MapLegend() {
  return (
    <div className="legend" aria-label="Žymių reikšmės">
      {LEGEND.map(([kind, label]) => (
        <span key={kind}>
          <i style={MARKS[kind].style}>{MARKS[kind].glyph}</i>
          {label}
        </span>
      ))}
    </div>
  );
}
