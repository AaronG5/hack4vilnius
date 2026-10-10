// Profilis from the demo: impact, stats, badges, Vilnius landmark collection, prizes, own reports.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ProblemItem } from "../components/ProblemItem";
import { earnedLandmarks, LANDMARKS, level, myDistrict, type Landmark } from "../lib/activity";
import { initials, plural, shortDate } from "../lib/format";
import { myActivity } from "../lib/problemModel";
import { useAppState } from "../state/appState";
import "./ProfilePage.css";

// TODO(api-gap): partner prizes and redeeming (GET /rewards, POST /rewards/{id}/redeem).
const PRIZES: [string, number][] = [
  ["JUDU kelionių kreditas", 500],
  ["Go Vilnius renginio bilietas", 1500],
];

const LOCK = "M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z";

function LandmarkIcon({ landmark, size, locked }: { landmark: Landmark; size: number; locked: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <path fill={locked ? "#B9B9B9" : "var(--red)"} fillRule="evenodd" d={landmark.d} />
    </svg>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { me, views, toast } = useAppState();
  const points = me?.points ?? 0;

  const acts = useMemo(() => myActivity(views, me?.id), [views, me?.id]);
  const mine = views.filter((v) => v.mine);
  const voted = views.filter((v) => v.myVote);
  const helped = mine.filter((v) => v.isFixed).length + voted.filter((v) => v.isFixed).length;
  // Trust: how often your "fixed / still there" answers agree with the outcome.
  const agree = voted.filter((v) => (v.myVote === "fixed") === v.isFixed).length;
  const trust = voted.length ? `${Math.round((agree / voted.length) * 100)} %` : "–";
  const checks = acts.filter((a) => a.type !== "report").length;
  const earned = earnedLandmarks(acts);
  const earnedIds = new Set(earned.map((e) => e.landmark.id));
  const areas = [...new Set(LANDMARKS.map((l) => l.area))];

  // TODO(api-gap): badges should come from GET /users/me/badges once the backend awards them.
  const badges: [string, boolean, string, string, string][] = [
    ["Pirmasis pranešėjas", mine.length >= 1, "M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z M12 8.5 a2 2 0 1 0 .01 0", "var(--red)", "pirmas pranešimas"],
    ["Tiesos tikrintojas", checks >= 5, "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M9 12l2 2 4-4", "var(--green)", `dar ${Math.max(0, 5 - checks)} patikr.`],
    ["Žiemos sargas", false, "M12 2v20 M4 6l16 12 M20 6L4 18", "var(--btn)", "sezono iššūkis"],
  ];

  return (
    <main className="app-main">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar">{initials(me?.name ?? "")}</span>
        <div>
          <h1 className="pg" style={{ fontSize: 24 }}>
            {me?.name || "Jūsų profilis"}
          </h1>
          <p className="pgsub" style={{ margin: 0 }}>
            {level(points)} · {me?.district?.name ?? myDistrict(acts)} · {points} tšk.
          </p>
        </div>
      </div>

      <section className="redcard">
        <span className="tag" style={{ background: "var(--pink)", alignSelf: "flex-start" }}>
          Jūsų indėlis
        </span>
        <b style={{ fontSize: 22, lineHeight: 1.2 }}>
          {helped
            ? `Jūsų veiksmai padėjo sutvarkyti ${helped} ${plural(helped, ["problemą", "problemas", "problemų"])}`
            : "Praneškite ar patikrinkite — ir čia matysite savo poveikį"}
        </b>
        <small>+20 tšk. už pranešimą, +10 už patikrinimą ar naują nuotrauką.</small>
      </section>

      <div className="grid3" style={{ marginTop: 10 }}>
        <div className="card stat">
          <b>{mine.length}</b>Pranešimai
        </div>
        <div className="card stat">
          <b>{checks}</b>Patikrinimai
        </div>
        <div className="card stat">
          <b>{trust}</b>Patikimumas
        </div>
      </div>

      <h2 className="sec">Ženkleliai</h2>
      <div className="grid3">
        {badges.map(([name, has, icon, color, hint]) => (
          <div key={name} className={`card badge${has ? "" : " locked"}`}>
            <span className="bic" style={{ background: has ? color : "var(--surface-2)", color: has ? "#fff" : "var(--muted)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={has ? icon : LOCK} />
              </svg>
            </span>
            <b>{name}</b>
            {!has && <small>{hint}</small>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="sec" style={{ margin: 0 }}>
            Vilniaus kolekcija
          </h2>
          <span className="tag" style={{ background: "var(--red)", color: "#fff" }}>
            {earned.length} / {LANDMARKS.length}
          </span>
        </div>
        <p className="m" style={{ margin: "6px 0 10px" }}>
          Praneškite arba patikrinkite problemą šalia objekto — ženklelis atsiras kolekcijoje.
        </p>
        {areas.map((area) => {
          const ls = LANDMARKS.filter((l) => l.area === area);
          return (
            <div key={area}>
              <div style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 6px" }}>
                {area} <span className="m">{ls.filter((l) => earnedIds.has(l.id)).length} / {ls.length}</span>
              </div>
              <div className="lmgrid">
                {ls.map((l) => {
                  const e = earned.find((x) => x.landmark.id === l.id);
                  return (
                    <div key={l.id} className={`lm${e ? "" : " locked"}`} title={l.name}>
                      <LandmarkIcon landmark={l} size={56} locked={!e} />
                      <span>{l.name}</span>
                      {e ? (
                        <em>{shortDate(e.at)}</em>
                      ) : (
                        <i aria-label="neatrakinta">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                            <path d={LOCK} />
                          </svg>
                        </i>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="sec">Partnerių prizai</h2>
      <div className="list">
        {PRIZES.map(([name, cost]) => (
          <div key={name} className="item" style={{ cursor: "default" }}>
            <span style={{ flex: 1 }}>
              <span className="t">{name}</span>
              <br />
              <span className="m">
                {cost} taškų{points < cost ? ` · trūksta ${cost - points}` : ""}
              </span>
            </span>
            <button
              type="button"
              className={`btn${points >= cost ? "" : " ghost"}`}
              disabled={points < cost}
              style={{ height: 40, fontSize: 13 }}
              onClick={() => toast("Prizų keitimas bus įjungtas kartu su partneriais")}
            >
              {points >= cost ? "Iškeisti" : "Užrakinta"}
            </button>
          </div>
        ))}
      </div>

      <h2 className="sec">Mano pranešimai</h2>
      {mine.length ? (
        <div className="list">
          {mine.map((v) => (
            <ProblemItem key={v.id} view={v} onOpen={(id) => navigate(`/problems/${id}`)} />
          ))}
        </div>
      ) : (
        <div className="card empty">Dar nepranešėte apie jokią problemą.</div>
      )}
    </main>
  );
}
