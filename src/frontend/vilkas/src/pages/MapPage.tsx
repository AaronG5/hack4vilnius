// Board 1 · Žemėlapis su filtru + pranešimo mygtukas.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listProblems, type Problem } from "../api";
import { BottomNav } from "../components/BottomNav";
import { CloseIcon, FilterIcon, PlusIcon, SearchIcon } from "../components/icons";
import { MapCanvas, UserDot } from "../components/map/MapCanvas";
import { MarkerSwatch, StatusMarker } from "../components/map/StatusMarker";
import { ReportSheet } from "../components/ReportSheet";
import { useApi } from "../hooks/useApi";
import { DEFAULT_USER_LOCATION, distanceMeters, formatDistance } from "../lib/geo";
import { positionOf } from "../lib/mapProjection";
import { MAP_STATE_LABEL, mapState, type MapState } from "../lib/problemStatus";
import "./MapPage.css";

type Filter = "all" | "new" | "work" | "fixed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Visos" },
  { id: "new", label: "Nepatvirtintos" },
  { id: "work", label: "Sprendžiamos" },
  { id: "fixed", label: "Sutvarkytos" },
];

const LEGEND: Exclude<MapState, "hidden">[] = ["new", "confirmed", "work", "fixed"];

function matches(filter: Filter, state: MapState): boolean {
  if (state === "hidden") return false;
  return filter === "all" || filter === state;
}

// "Still there?" prompts go to confirmed or unconfirmed problems near the user.
function nearestToCheck(problems: Problem[]) {
  return problems
    .filter((p) => p.status === "unconfirmed" || p.status === "confirmed")
    .map((p) => ({ problem: p, meters: distanceMeters(DEFAULT_USER_LOCATION, p.location.coordinates) }))
    .sort((a, b) => a.meters - b.meters)[0];
}

export function MapPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const { data: problems = [], error } = useApi((signal) => listProblems({}, signal), "problems");

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, new: 0, work: 0, fixed: 0 };
    for (const p of problems) {
      const state = mapState(p.status);
      if (state === "hidden") continue;
      result.all++;
      if (state !== "confirmed") result[state]++;
    }
    return result;
  }, [problems]);

  const visible = problems.filter((p) => matches(filter, mapState(p.status)));
  const nearest = nearestToCheck(problems);

  return (
    <main className="map-page">
      <MapCanvas>
        {visible.map((p) => {
          const state = mapState(p.status);
          if (state === "hidden") return null;
          return (
            <StatusMarker
              key={p.id}
              state={state}
              title={p.category.name}
              style={positionOf(p.location.coordinates)}
              onClick={() => navigate(`/problems/${p.id}`)}
            />
          );
        })}
        <UserDot at={DEFAULT_USER_LOCATION} />
      </MapCanvas>

      <div className="map-page__top">
        <label className="map-page__search notch">
          <SearchIcon size={20} />
          <input type="search" placeholder="Ieškoti gatvės ar problemos" aria-label="Ieškoti gatvės ar problemos" />
        </label>
        <button
          type="button"
          className="map-page__filter-btn notch"
          aria-label="Filtruoti problemas"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <FilterIcon size={20} />
        </button>
      </div>

      {showFilters && (
        <div className="map-page__chips" role="group" aria-label="Problemų filtras">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="map-chip notch-sm"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setSheetOpen(false);
              }}
            >
              {f.id === "new" && <span className="map-chip__new">?</span>}
              {f.label} {counts[f.id]}
            </button>
          ))}
        </div>
      )}

      {filter === "new" ? (
        <div className="map-banner notch">
          {/* TODO(api-gap): weekly challenge progress */}
          <span className="map-banner__progress">3/5</span>
          <span className="map-banner__text">
            <strong>Patikrinkite nepatvirtintas</strong>
            <span>{counts.new} laukia netoliese · +10 tšk. už kiekvieną</span>
          </span>
        </div>
      ) : (
        nearest && (
          <Link to={`/problems/${nearest.problem.id}/verify`} className="map-banner notch">
            <span className="map-banner__dot" />
            <span className="map-banner__line">
              {nearest.problem.category.name} už {formatDistance(nearest.meters)} — <strong>vis dar yra?</strong>
            </span>
            <span className="map-banner__points">+10</span>
          </Link>
        )
      )}

      {error && (
        <div className="map-page__error notch" role="alert">
          Nepavyko įkelti problemų. <button onClick={() => window.location.reload()}>Bandyti dar kartą</button>
        </div>
      )}

      <div className="map-legend notch">
        {LEGEND.map((state) => (
          <span key={state}>
            <MarkerSwatch state={state} />
            {MAP_STATE_LABEL[state]}
          </span>
        ))}
      </div>

      {sheetOpen && <ReportSheet onClose={() => setSheetOpen(false)} />}

      <button
        type="button"
        className="map-fab"
        aria-label={sheetOpen ? "Uždaryti meniu" : "Pranešti apie problemą"}
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen((v) => !v)}
      >
        {sheetOpen ? <CloseIcon size={34} /> : <PlusIcon size={38} />}
      </button>

      <BottomNav />
    </main>
  );
}
