import type { CSSProperties } from "react";
import type { MapState } from "../../lib/problemStatus";
import { MAP_STATE_LABEL } from "../../lib/problemStatus";
import "./StatusMarker.css";

interface StatusMarkerProps {
  state: Exclude<MapState, "hidden">;
  /** Shown inside the marker, e.g. a cluster count. Unconfirmed markers show "?". */
  label?: string;
  title?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function StatusMarker({ state, label, title, onClick, style }: StatusMarkerProps) {
  const text = label ?? (state === "new" ? "?" : "");
  const name = title ? `${MAP_STATE_LABEL[state]}: ${title}` : MAP_STATE_LABEL[state];
  return (
    <button
      type="button"
      className={`marker marker--${state}`}
      aria-label={name}
      onClick={onClick}
      style={style}
    >
      {state === "new" && <span className="marker__pulse" aria-hidden="true" />}
      <span className="marker__body">{text}</span>
    </button>
  );
}

/** Small legend swatch matching the marker styles. */
export function MarkerSwatch({ state }: { state: Exclude<MapState, "hidden"> }) {
  return (
    <span className={`marker-swatch marker-swatch--${state}`} aria-hidden="true">
      {state === "new" ? "?" : ""}
    </span>
  );
}
