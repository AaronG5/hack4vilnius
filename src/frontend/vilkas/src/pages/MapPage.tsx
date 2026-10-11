// Map view from the demo: filters, "vis dar yra?" prompt, real map, legend, ranked list.
// Sheets (report flow, problem details) render through the <Outlet />.

import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { PinIcon, RouteIcon } from "../components/icons";
import { LazyMap, MapLegend } from "../components/map/LazyMap";
import { MARKS } from "../components/map/marks";
import { ProblemItem } from "../components/ProblemItem";
import { WEEKLY_GOAL, weekChecks } from "../lib/activity";
import { distanceMeters, formatDistance, isNear, NEAR_RADIUS_M, type LngLat } from "../lib/geo";
import { myActivity, type ProblemView } from "../lib/problemModel";
import { googleMapsUrl, routeSummary } from "../lib/routePlanner";
import { setActiveRoute, useActiveRoute } from "../lib/routeStore";
import { useWatchedFix } from "../lib/useWatchedFix";
import { useAppState, type MapFilter } from "../state/appState";
import "./MapPage.css";

const FILTERS: [MapFilter, string][] = [
  ["all", "Visos"],
  ["new", "Nepatvirtintos"],
  // Problems you answered (gray on the map, "Jūs atsakėte" in the legend).
  ["checked", "Atsakytos"],
  ["work", "Sprendžiamos"],
  ["fixed", "Sutvarkytos"],
];

function passes(filter: MapFilter, v: ProblemView): boolean {
  if (filter === "all") return true;
  if (filter === "new") return v.status === "new";
  if (filter === "checked") return v.myVote !== undefined;
  if (filter === "work") return v.status === "work";
  return v.isFixed;
}

function listFor(filter: MapFilter, views: ProblemView[], shown: ProblemView[]): [string, ProblemView[]] {
  if (filter === "new")
    return ["Laukia patvirtinimo", [...shown].sort((a, b) => Number(!!a.myVote) - Number(!!b.myVote) || b.score - a.score)];
  if (filter === "checked") return ["Jūsų atsakytos", [...shown].sort((a, b) => b.created - a.created)];
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
  const { views: all, filter, setFilter, loaded, error, me } = useAppState();
  // Fixed problems stay on the map, green, only while neighbours may confirm the fix.
  const views = useMemo(() => all.filter((v) => !v.isFixed || v.fixWindowOpen), [all]);
  const open = (id: string) => navigate(`/problems/${id}`);
  // Live position: answers are only taken on site, so it's watched rather than read once.
  // It's shared with the problem sheet through the outlet context.
  const located = useWatchedFix();
  // Set when the user taps "Mano vieta" on the map; also starts the watch.
  const [tapped, setTapped] = useState<LngLat>();
  const here = located.fix?.at ?? tapped;
  const onLocate = (at: LngLat) => {
    setTapped(at);
    located.start();
  };

  const shown = useMemo(() => views.filter((v) => passes(filter, v)), [views, filter]);
  const pins = useMemo(
    () =>
      shown.map((v) => ({
        id: v.id,
        at: v.at,
        status: v.status,
        title: v.title,
        score: v.score,
        // Answered already: gray, so what still needs checking stands out.
        checked: v.myVote !== undefined,
      })),
    [shown],
  );
  const counts: Record<MapFilter, number> = {
    all: views.length,
    new: views.filter((v) => v.status === "new").length,
    checked: views.filter((v) => v.myVote !== undefined).length,
    work: views.filter((v) => v.status === "work").length,
    fixed: views.filter((v) => v.isFixed).length,
  };
  const [title, list] = listFor(filter, views, shown);

  // Prompt: skip your own and already answered; nearest first once the location is known,
  // otherwise unconfirmed first, then priority.
  const toCheck = views
    .filter((v) => !v.isFixed && v.status !== "work" && !v.mine && !v.myVote)
    .sort((a, b) =>
      here
        ? distanceMeters(here, a.at) - distanceMeters(here, b.at)
        : Number(a.status !== "new") - Number(b.status !== "new") || b.score - a.score,
    );
  const near = toCheck[0];
  // Within NEAR_RADIUS_M of an unchecked problem: offer the answer without tapping its pin.
  const fix = located.fix;
  const onSite = fix ? toCheck.find((v) => isNear(fix, v.at)) : undefined;
  const todo = shown.filter((v) => !v.mine && !v.myVote).length;
  const week = Math.min(WEEKLY_GOAL, weekChecks(myActivity(views, me?.id)));

  // The walk in progress: a stop is done once you've answered (or reported) it,
  // or it was fixed or taken on by the city meanwhile.
  const route = useActiveRoute();
  const stopDone = (id: string) => {
    const v = all.find((x) => x.id === id);
    return !v || v.mine || v.myVote !== undefined || v.isFixed || v.status === "work";
  };
  const routeStops = route?.stops.map((s, i) => ({ ...s, n: i + 1, done: stopDone(s.id) })) ?? [];
  const nextStop = routeStops.find((s) => !s.done);
  const doneCount = routeStops.filter((s) => s.done).length;
  const mapRoute = route ? { path: route.path, stops: routeStops.map((s) => ({ at: s.at, n: s.n, done: s.done })) } : undefined;

  return (
    <>
      <main className="app-main map-page">
        <div className="map-top">
          <div className="filters" role="group" aria-label="Rodyti žemėlapyje">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {id !== "all" && (
                  <i className="mark" style={MARKS[id].style} aria-hidden="true">
                    {MARKS[id].glyph}
                  </i>
                )}
                {label} <span className="cnt">{counts[id]}</span>
              </button>
            ))}
          </div>

          {route ? (
            <section className="route-card" aria-label="Maršrutas">
              <div className="row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
                <RouteIcon size={20} />
                <b style={{ flex: 1 }}>
                  Maršrutas · {doneCount}/{routeStops.length} patikrinta
                </b>
                <span className="sm">{routeSummary(route.distanceM, route.durationS, route.stops.length)}</span>
              </div>
              <span className="bar" style={{ height: 6 }}>
                <i style={{ height: 6, width: `${(doneCount / Math.max(1, routeStops.length)) * 100}%` }} />
              </span>
              {nextStop ? (
                <button type="button" className="prompt" style={{ margin: 0 }} onClick={() => open(nextStop.id)}>
                  <span className="route-n">{nextStop.n}</span>
                  <span className="txt">
                    <small>Kita stotelė{here ? ` · už ${formatDistance(distanceMeters(here, nextStop.at))}` : ""}</small>
                    <b>{nextStop.title}</b>
                  </span>
                </button>
              ) : (
                <b>Maršrutas įveiktas – ačiū! Taškai ateis, kai atsakymai pasitvirtins.</b>
              )}
              <div className="row">
                {nextStop && (
                  <a
                    className="btn ghost"
                    style={{ flex: 1, height: 40, fontSize: 13 }}
                    href={googleMapsUrl(here ?? route.start, routeStops.filter((s) => !s.done))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Maps
                  </a>
                )}
                <button type="button" className="btn ghost" style={{ flex: 1, height: 40, fontSize: 13 }} onClick={() => setActiveRoute(null)}>
                  {nextStop ? "Baigti maršrutą" : "Uždaryti"}
                </button>
              </div>
            </section>
          ) : (
            <button type="button" className="prompt route" onClick={() => navigate("/map/route")}>
              <RouteIcon size={18} />
              <span className="txt">
                <b>Planuoti maršrutą</b>
                <small>Pasivaikščiokite per artimiausias problemas ir jas patikrinkite</small>
              </span>
            </button>
          )}

          {onSite ? (
            <button type="button" className="prompt onsite" onClick={() => open(onSite.id)}>
              <span className="pulse" aria-hidden="true">
                <PinIcon size={18} />
              </span>
              <span className="txt">
                <small>Jūs šalia · {formatDistance(distanceMeters(onSite.at, here ?? onSite.at))}</small>
                <b>{onSite.category} – vis dar yra?</b>
              </span>
              {/* Paid once the answer proves right (problems/lifecycle.py). */}
              <span className="go">Patikrinti · +10</span>
            </button>
          ) : (
            !located.fix && (
              <button type="button" className="prompt locate" onClick={located.start} disabled={located.watching}>
                <PinIcon size={18} />
                <span className="txt">
                  {located.error ? (
                    <span role="alert">{located.error}</span>
                  ) : located.watching ? (
                    <b>Nustatoma vieta…</b>
                  ) : (
                    <>
                      <b>Įjunkite lokaciją</b>
                      <small>Problemas patvirtinti galima tik būnant šalia – iki {NEAR_RADIUS_M} m</small>
                    </>
                  )}
                </span>
              </button>
            )
          )}

          {onSite ? null : filter === "new" ? (
            <div className="card wk" style={{ marginBottom: 10 }}>
              <span className="wkn">{week}/{WEEKLY_GOAL}</span>
              <span style={{ flex: 1 }}>
                <b>Patikrinkite nepatvirtintas</b>
                <br />
                <span className="m">
                  {todo ? `${todo} laukia jūsų · +10 tšk. už kiekvieną pasitvirtinusį atsakymą` : "Visas aplinkui jau patikrinote – ačiū!"}
                </span>
              </span>
            </div>
          ) : (
            near && (
              <button type="button" className="prompt" onClick={() => open(near.id)}>
                <span className="dot" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {near.category} · {here ? `už ${formatDistance(distanceMeters(here, near.at))}` : near.address || near.district} –{" "}
                  <b>vis dar yra?</b> Nueikite iki jos ir patikrinkite.
                </span>
                <span className="tag lime">+10</span>
              </button>
            )
          )}
        </div>

        <div className="map-pane">
          <LazyMap label="Vilniaus žemėlapis su pranešimais" height={400} pins={pins} onOpen={open} onLocate={onLocate} route={mapRoute} />
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
      <Outlet context={located} />
    </>
  );
}
