// Map view from the demo: filters, "vis dar yra?" prompt, real map, legend, ranked list.
// Sheets (report flow, problem details) render through the <Outlet />.

import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LazyMap, MapLegend } from "../components/map/LazyMap";
import { ProblemItem } from "../components/ProblemItem";
import { weekChecks } from "../lib/activity";
import { distanceMeters, formatDistance, type LngLat } from "../lib/geo";
import { myActivity, type ProblemView } from "../lib/problemModel";
import { useAppState, type MapFilter } from "../state/appState";
import "./MapPage.css";

const FILTERS: [MapFilter, string][] = [
  ["all", "Visos"],
  ["new", "Nepatvirtintos"],
  ["work", "Sprendžiamos"],
  ["fixed", "Sutvarkytos"],
];

function passes(filter: MapFilter, v: ProblemView): boolean {
  if (filter === "all") return true;
  if (filter === "new") return v.status === "new";
  if (filter === "work") return v.status === "work";
  return v.isFixed;
}

function listFor(filter: MapFilter, views: ProblemView[], shown: ProblemView[]): [string, ProblemView[]] {
  if (filter === "new")
    return ["Laukia patvirtinimo", [...shown].sort((a, b) => Number(!!a.myVote) - Number(!!b.myVote) || b.score - a.score)];
  if (filter === "work") return ["Sprendžiamos", [...shown].sort((a, b) => b.score - a.score)];
  if (filter === "fixed") return ["Sutvarkytos", [...shown].sort((a, b) => b.created - a.created)];
  return [
    "Svarbiausios neišspręstos",
    views
      .filter((v) => !v.isFixed)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
  ];
}

export function MapPage() {
  const navigate = useNavigate();
  const { views, filter, setFilter, loaded, error, me } = useAppState();
  const open = (id: string) => navigate(`/problems/${id}`);
  // Set when the user taps "Mano vieta" on the map.
  const [here, setHere] = useState<LngLat>();

  const shown = useMemo(() => views.filter((v) => passes(filter, v)), [views, filter]);
  const pins = useMemo(() => shown.map((v) => ({ id: v.id, at: v.at, status: v.status, title: v.title, score: v.score })), [shown]);
  const counts: Record<MapFilter, number> = {
    all: views.length,
    new: views.filter((v) => v.status === "new").length,
    work: views.filter((v) => v.status === "work").length,
    fixed: views.filter((v) => v.isFixed).length,
  };
  const [title, list] = listFor(filter, views, shown);

  // Prompt: skip your own and already answered; nearest first once the location is known,
  // otherwise unconfirmed first, then priority.
  const near = views
    .filter((v) => !v.isFixed && v.status !== "work" && !v.mine && !v.myVote)
    .sort((a, b) =>
      here
        ? distanceMeters(here, a.at) - distanceMeters(here, b.at)
        : Number(a.status !== "new") - Number(b.status !== "new") || b.score - a.score,
    )[0];
  const todo = shown.filter((v) => !v.mine && !v.myVote).length;
  const week = Math.min(5, weekChecks(myActivity(views, me?.id)));

  return (
    <>
      <main className="app-main map-page">
        <div className="map-top">
          <div className="filters" role="group" aria-label="Rodyti žemėlapyje">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip${id === "new" ? " fnew" : ""}`}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {id === "new" && <i>?</i>}
                {label} <span className="cnt">{counts[id]}</span>
              </button>
            ))}
          </div>

          {filter === "new" ? (
            <div className="card wk" style={{ marginBottom: 10 }}>
              <span className="wkn">{week}/5</span>
              <span style={{ flex: 1 }}>
                <b>Patikrinkite nepatvirtintas</b>
                <br />
                <span className="m">
                  {todo ? `${todo} laukia jūsų · +10 tšk. už kiekvieną` : "Visas aplinkui jau patikrinote — ačiū!"}
                </span>
              </span>
            </div>
          ) : (
            near && (
              <button type="button" className="prompt" onClick={() => open(near.id)}>
                <span className="dot" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {near.category} · {here ? `už ${formatDistance(distanceMeters(here, near.at))}` : near.address || near.district} —{" "}
                  <b>vis dar yra?</b>
                </span>
                <span className="tag lime">+10</span>
              </button>
            )
          )}
        </div>

        <div className="map-pane">
          <LazyMap label="Vilniaus žemėlapis su pranešimais" height={400} pins={pins} onOpen={open} onLocate={setHere} />
          <MapLegend />
        </div>

        <div className="map-list">
          <h2 className="sec">{title}</h2>
          {!loaded ? (
            <div className="card empty">Įkeliama…</div>
          ) : error && views.length === 0 ? (
            <div className="card empty" role="alert">
              Nepavyko įkelti pranešimų.
            </div>
          ) : list.length ? (
            <div className="list">
              {list.map((v) => (
                <ProblemItem key={v.id} view={v} onOpen={open} />
              ))}
            </div>
          ) : (
            <div className="card empty">
              {filter === "all"
                ? "Kol kas pranešimų nėra. Paspauskite raudoną mygtuką ir praneškite apie pirmą problemą."
                : "Šiame filtre problemų nėra."}
            </div>
          )}
        </div>
      </main>
      <Outlet />
    </>
  );
}
