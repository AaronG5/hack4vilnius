// Schematic Vilnius map from the demo: districts (from the API), roads, Neris, notched pins.

import type { MouseEvent } from "react";
import type { District } from "../api";
import { districtLabelAt, districtPolygon, MAP_H, MAP_W, pinPath, type XY } from "../lib/cityMap";
import { STATUS_LABEL, type ProblemView } from "../lib/problemModel";
import "./CityMap.css";

interface CityMapProps {
  districts: District[];
  pins: ProblemView[];
  onOpen?: (id: string) => void;
  /** Pick mode: pins fade, tapping the map reports the point. */
  onPick?: (point: XY) => void;
  mark?: XY;
}

const PIN = 9;

export function CityMap({ districts, pins, onOpen, onPick, mark }: CityMapProps) {
  const pick = Boolean(onPick);

  const handleClick = (ev: MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const svg = ev.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    onPick([Math.max(4, Math.min(MAP_W - 4, pt.x)), Math.max(4, Math.min(MAP_H - 4, pt.y))]);
  };

  return (
    <div className="mapwrap">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label="Schematinis Vilniaus žemėlapis su pranešimais"
        onClick={handleClick}
        style={pick ? { cursor: "crosshair" } : undefined}
      >
        <MapBaseLayers districts={districts} />
        {pins.map((m) => {
          const [x, y] = m.xy;
          const color = m.status === "fixed" ? "var(--green)" : m.status === "work" ? "var(--yellow)" : "var(--red)";
          const isNew = m.status === "new";
          const open = () => onOpen?.(m.id);
          return (
            <g
              key={m.id}
              className="pin"
              opacity={pick ? 0.45 : undefined}
              {...(!pick && {
                role: "button",
                tabIndex: 0,
                "aria-label": `${m.title}, ${STATUS_LABEL[m.status]}, prioritetas ${m.score}`,
                onClick: open,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                },
              })}
            >
              <circle cx={x} cy={y} r="15" fill="transparent" />
              {isNew && !pick && <path className="pulse" d={pinPath(x, y, PIN + 2)} fill="var(--red)" />}
              <path
                d={pinPath(x, y, PIN)}
                fill={color}
                fillOpacity={isNew ? 0.45 : 1}
                stroke="var(--surface)"
                strokeWidth="2"
              />
              {isNew && (
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" pointerEvents="none">
                  ?
                </text>
              )}
            </g>
          );
        })}
        {mark && (
          <>
            <circle cx={mark[0]} cy={mark[1]} r="16" fill="none" stroke="var(--red)" strokeWidth="3" />
            <circle cx={mark[0]} cy={mark[1]} r="5" fill="var(--red)" />
          </>
        )}
      </svg>
    </div>
  );
}

export function MapBaseLayers({ districts, labels = true }: { districts: District[]; labels?: boolean }) {
  return (
    <>
      <rect width={MAP_W} height={MAP_H} fill="var(--map-land)" />
      {districts.map((d, i) => (
        <polygon
          key={d.id}
          points={districtPolygon(d)
            .map((p) => p.join(","))
            .join(" ")}
          fill={i % 2 ? "var(--map-d1)" : "var(--map-d2)"}
          stroke="var(--map-road)"
          strokeWidth="3"
        />
      ))}
      <g stroke="var(--map-road)" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".9">
        <path d="M40 0 L95 440" />
        <path d="M0 120 L400 90" />
        <path d="M0 380 L400 350" />
        <path d="M265 0 L285 440" />
        <path d="M150 230 L215 440" />
      </g>
      <path
        d="M-10 238 C 60 205,120 255,190 230 S 300 185,410 210"
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <text x="44" y="226" fontSize="10" fontStyle="italic" fill="var(--map-label)">
        Neris
      </text>
      {labels &&
        districts.map((d) => {
          const [x, y] = districtLabelAt(districtPolygon(d));
          return (
            <text key={d.id} x={x} y={y} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--map-label)">
              {d.name}
            </text>
          );
        })}
    </>
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
