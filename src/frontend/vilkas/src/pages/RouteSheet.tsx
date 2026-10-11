// Route planner sheet: choose what to check and for how long, preview the walk,
// then start it (drawn on the map, with progress) or open it in Google Maps.

import { useCallback, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { walkingRoute } from "../api";
import { LazyMap } from "../components/map/LazyMap";
import { Sheet } from "../components/Sheet";
import { formatDistance, distanceMeters, VILNIUS_CENTER, type LngLat } from "../lib/geo";
import {
  candidates,
  DURATIONS,
  estimate,
  FOCUSES,
  googleMapsUrl,
  planStops,
  routeSummary,
  type PlannedRoute,
  type RouteFocus,
} from "../lib/routePlanner";
import { setActiveRoute } from "../lib/routeStore";
import type { WatchedFix } from "../lib/useWatchedFix";
import { useAppState } from "../state/appState";

export function RouteSheet() {
  const navigate = useNavigate();
  const close = useCallback(() => navigate("/map"), [navigate]);
  const { views, toast } = useAppState();
  const located = useOutletContext<WatchedFix | undefined>();
  const [focus, setFocus] = useState<RouteFocus>("hazards");
  const [minutes, setMinutes] = useState<number>(30);
  const [plan, setPlan] = useState<PlannedRoute>();
  const [busy, setBusy] = useState(false);

  const here = located?.fix?.at;
  const start: LngLat = here ?? VILNIUS_CENTER;
  const available = candidates(views, focus).length;

  const build = async () => {
    setBusy(true);
    const stops = planStops(views, start, focus, minutes);
    const rough = estimate(start, stops);
    let route: PlannedRoute = {
      focus,
      minutes,
      start,
      stops,
      path: [start, ...stops.map((s) => s.at)],
      onStreets: false,
      distanceM: rough.distanceM,
      durationS: rough.durationS,
      createdAt: Date.now(),
    };
    if (stops.length) {
      try {
        // Follow streets and paths; if the router is down, straight lines will do.
        const walk = await walkingRoute([start, ...stops.map((s) => s.at)]);
        route = { ...route, path: walk.path.coordinates, onStreets: true, distanceM: walk.distance_m, durationS: walk.duration_s };
      } catch {
        // Keep the straight-line estimate.
      }
    }
    setPlan(route);
    setBusy(false);
  };

  const begin = () => {
    if (!plan) return;
    setActiveRoute(plan);
    navigate("/map");
    toast(`Maršrutas pradėtas – ${plan.stops.length} stotelės`);
  };

  const focusLabel = FOCUSES.find((f) => f.id === focus)?.label.toLowerCase() ?? "";

  return (
    <Sheet label="Maršruto planavimas" onClose={close}>
      <h1>Pasivaikščiojimas su tikslu</h1>
      <p className="lead">
        Sudarysime pėsčiųjų maršrutą per problemas, kurias verta patikrinti. Pakeliui atsakykite būdami šalia – +10 tšk. už kiekvieną
        pasitvirtinusį atsakymą.
      </p>

      {!here && (
        <div className="note warn" role="status">
          {located?.error ?? "Vieta neįjungta – maršrutą planuosime nuo miesto centro."}{" "}
          {!located?.watching && (
            <button type="button" className="chip" onClick={located?.start}>
              Įjungti vietą
            </button>
          )}
        </div>
      )}

      <div className="fld" role="group" aria-label="Ką tikrinti">
        Ką tikrinti
        <div className="list">
          {FOCUSES.map((f) => (
            <button
              key={f.id}
              type="button"
              className="src"
              aria-pressed={focus === f.id}
              style={focus === f.id ? { outline: "2px solid var(--red)" } : undefined}
              onClick={() => {
                setFocus(f.id);
                setPlan(undefined);
              }}
            >
              <span style={{ flex: 1 }}>
                <b>{f.label}</b>
                <small>{f.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="fld" role="group" aria-label="Kiek laiko">
        Kiek laiko turite
        <div className="seg" style={{ gridTemplateColumns: `repeat(${DURATIONS.length}, minmax(0,1fr))` }}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={minutes === d}
              onClick={() => {
                setMinutes(d);
                setPlan(undefined);
              }}
            >
              {d} min.
            </button>
          ))}
        </div>
      </div>

      {!plan ? (
        <button type="button" className="btn" disabled={busy || available === 0} onClick={() => void build()}>
          {busy ? "Planuojama…" : available === 0 ? `Šiuo metu tikrinti nėra ką (${focusLabel})` : "Sudaryti maršrutą"}
        </button>
      ) : plan.stops.length === 0 ? (
        <div className="note">
          Per {minutes} min. pasiekiamų problemų nėra (artimiausia per toli). Pasirinkite daugiau laiko ar kitą tipą.
        </div>
      ) : (
        <>
          <LazyMap
            label="Maršruto peržiūra"
            height={240}
            cluster={false}
            pins={[]}
            mark={plan.start}
            route={{ path: plan.path, stops: plan.stops.map((s, i) => ({ at: s.at, n: i + 1, done: false })) }}
          />
          <p style={{ fontWeight: 700, margin: 0 }}>
            {plan.stops.length} {plan.stops.length === 1 ? "stotelė" : plan.stops.length < 10 ? "stotelės" : "stotelių"} ·{" "}
            {routeSummary(plan.distanceM, plan.durationS, plan.stops.length)}
            {!plan.onStreets && <span className="sm"> (tiesiomis linijomis – gatvių maršrutas nepasiekiamas)</span>}
          </p>
          <ol className="list" style={{ paddingLeft: 0, listStyle: "none" }}>
            {plan.stops.map((s, i) => {
              const from = i === 0 ? plan.start : plan.stops[i - 1].at;
              return (
                <li key={s.id} className="item" style={{ cursor: "default" }}>
                  <span className="route-n">{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="t">{s.title}</span>
                    <br />
                    <span className="m">
                      {s.category} · už {formatDistance(distanceMeters(from, s.at))}
                    </span>
                  </span>
                  <span className="score s-mid">{s.score}</span>
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn bright" onClick={begin}>
            Pradėti maršrutą
          </button>
          <a className="btn ghost" href={googleMapsUrl(plan.start, plan.stops)} target="_blank" rel="noopener noreferrer">
            Nurodymai Google Maps
          </a>
          <button type="button" className="btn link" onClick={() => setPlan(undefined)}>
            Planuoti iš naujo
          </button>
        </>
      )}
      <button type="button" className="btn ghost" onClick={close}>
        Uždaryti
      </button>
    </Sheet>
  );
}
