// Map view from the demo: filters, "vis dar yra?" prompt, schematic map, legend, ranked list.
// Sheets (report flow, problem details) render through the <Outlet />.

import { Outlet, useNavigate } from "react-router-dom";
import { CityMap, MapLegend } from "../components/CityMap";
import { ProblemItem } from "../components/ProblemItem";
import { weekChecks } from "../lib/activity";
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
  const { views, districts, filter, setFilter, loaded, error, me } = useAppState();
  const open = (id: string) => navigate(`/problems/${id}`);

  const shown = views.filter((v) => passes(filter, v));
  const counts: Record<MapFilter, number> = {
    all: views.length,
    new: views.filter((v) => v.status === "new").length,
    work: views.filter((v) => v.status === "work").length,
    fixed: views.filter((v) => v.isFixed).length,
  };
  const [title, list] = listFor(filter, views, shown);

  // Prompt: unconfirmed first, then highest priority, skipping your own and already answered.
  const near = views
    .filter((v) => !v.isFixed && v.status !== "work" && !v.mine && !v.myVote)
    .sort((a, b) => Number(a.status !== "new") - Number(b.status !== "new") || b.score - a.score)[0];
  const todo = shown.filter((v) => !v.mine && !v.myVote).length;
  const week = Math.min(5, weekChecks(myActivity(views, me?.id)));

  return (
    <>
      <main className="app-main">
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
                {near.category} · {near.address || near.district} — <b>vis dar yra?</b>
              </span>
              <span className="tag lime">+10</span>
            </button>
          )
        )}

        <CityMap districts={districts} pins={shown} onOpen={open} />
        <MapLegend />

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
      </main>
      <Outlet />
    </>
  );
}
