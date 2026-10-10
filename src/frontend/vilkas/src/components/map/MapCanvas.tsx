// Static illustrated map from the design boards; position children with positionOf().
// TODO(Phase 10): replace with Leaflet + OpenStreetMap tiles.

import type { ReactNode } from "react";
import type { LngLat } from "../../lib/geo";
import { positionOf } from "../../lib/mapProjection";
import "./MapCanvas.css";

export function MapCanvas({ children, dim = false }: { children?: ReactNode; dim?: boolean }) {
  return (
    <div className={`map-canvas${dim ? " map-canvas--dim" : ""}`}>
      <svg
        className="map-canvas__art"
        aria-hidden="true"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="390" height="844" fill="#E4E4E4" />
        <path
          d="M-20 300 C 80 250, 140 360, 230 320 S 360 250, 420 290 L 420 340 C 360 300, 300 380, 230 370 S 90 300, -20 350 Z"
          fill="#CED2DF"
        />
        <g stroke="#FFFFFF" strokeWidth="10" fill="none" strokeLinecap="round">
          <path d="M40 -10 L 120 860" />
          <path d="M-10 160 L 400 120" />
          <path d="M-10 520 L 400 470" />
          <path d="M260 -10 L 300 860" />
          <path d="M-10 680 L 400 640" />
        </g>
        <g stroke="#F5F5F5" strokeWidth="5" fill="none">
          <path d="M180 -10 L 200 860" />
          <path d="M-10 420 L 400 400" />
          <path d="M330 120 L 390 700" />
        </g>
        <rect x="135" y="185" width="40" height="70" rx="6" fill="#DDE7B5" />
        <rect x="210" y="545" width="70" height="50" rx="6" fill="#DDE7B5" />
      </svg>
      {children}
    </div>
  );
}

export function UserDot({ at }: { at: LngLat }) {
  return <div className="user-dot" style={positionOf(at)} aria-label="Jūsų vieta" role="img" />;
}
