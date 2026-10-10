// Board 9 · Rajono skydelis – statistics for one district over the last 8 weeks.

import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  activeResidents,
  avgResolveDays,
  decimal,
  districtTable,
  isReopened,
  niceMax,
  STAGES,
  weekBuckets,
  type WeekBucket,
} from "../../lib/cityStats";
import { count, shortDate } from "../../lib/format";
import { useAppState } from "../../state/appState";

const WEEKS = 8;
const DAY = 86_400_000;
const CHART_H = 220;

function WeekColumn({ week, top, index, hovered, onHover }: { week: WeekBucket; top: number; index: number; hovered: boolean; onHover: (i: number | null) => void }) {
  const total = week.views.length;
  const label = shortDate(week.start + DAY);
  // Keep the tooltip inside the chart at the edges.
  const tipPos = index >= WEEKS - 2 ? { right: 0 } : index <= 1 ? { left: 0 } : { left: "50%", transform: "translateX(-50%)" };
  return (
    <div
      className={`wk-col${hovered ? " on" : ""}`}
      tabIndex={0}
      aria-label={`${label}: gauta ${total}. ${STAGES.map((s) => `${s.name} ${week.counts[s.id]}`).join(", ")}`}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(index)}
      onBlur={() => onHover(null)}
    >
      <div className="wk-bar">
        {STAGES.map((s) => {
          const n = week.counts[s.id];
          return n ? <div key={s.id} style={{ height: Math.max(2, Math.round((n / top) * CHART_H) - 2), background: s.color }} /> : null;
        })}
      </div>
      {hovered && (
        <div className="wk-tip" style={tipPos}>
          <strong>{label}</strong>
          <span>Gauta: {total}</span>
          {STAGES.map((s) => (
            <span key={s.id} className="wk-tip-line">
              <i style={{ background: s.color }} />
              {s.name}: {week.counts[s.id]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function DistrictPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { views, districts, categories } = useAppState();
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // One reference time per page view keeps all windows consistent across re-renders.
  const [now] = useState(() => Date.now());

  const district = districts.find((d) => d.id === id);
  if (!district) return districts.length ? <Navigate to={`/city/districts/${districts[0].id}`} replace /> : null;

  const since = now - WEEKS * 7 * DAY;
  const inDistrict = views.filter((v) => v.district === district.name);
  const recent = inDistrict.filter((v) => v.created > since);
  const weeks = weekBuckets(inDistrict, WEEKS, now);
  const top = niceMax(Math.max(0, ...weeks.map((w) => w.views.length)));

  const fixed = recent.filter((v) => v.isFixed).length;
  const resolvedPct = recent.length ? Math.round((fixed / recent.length) * 100) : 0;
  const days = avgResolveDays(recent);
  const cityDays = avgResolveDays(views.filter((v) => v.created > since));
  const diff = days !== null && cityDays !== null ? Math.abs(days - cityDays) : null;
  const faster = days !== null && cityDays !== null && days <= cityDays;
  const same = diff !== null && diff < 0.05;
  const speedText = same ? "kaip miesto vidurkis" : `${decimal(diff ?? 0)} d. ${faster ? "greičiau" : "lėčiau"} nei miesto vid.`;
  const league = districtTable(views, districts.map((d) => d.name)).findIndex((r) => r.name === district.name) + 1;

  const totals = STAGES.map((s) => weeks.reduce((n, w) => n + w.counts[s.id], 0));
  const insight = `Iš ${recent.length} gautų: ${totals[0] + totals[1]} dar nepriskirta vykdytojui, ${totals[2] + totals[3]} jau perduota ar tvarkoma, ${totals[4]} sutvarkyta`;

  const cats = categories
    .map((c) => ({ name: c.name, n: recent.filter((v) => v.category === c.name).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const catMax = cats[0]?.n ?? 1;

  const waiting = inDistrict
    .filter((v) => !v.isFixed)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 3);

  const backlog = recent.filter((v) => !v.isFixed).length;
  const half = now - (WEEKS / 2) * 7 * DAY;
  const growing = recent.filter((v) => !v.isFixed && v.created > half).length > recent.filter((v) => !v.isFixed && v.created <= half).length;
  const summary = [
    days !== null && diff !== null
      ? same
        ? `${district.name} problemas sprendžia tiek pat laiko, kiek miesto vidurkis.`
        : `${district.name} problemas sprendžia ${decimal(diff)} d. ${faster ? "greičiau" : "lėčiau"} nei miesto vidurkis.`
      : `${district.name} per 8 savaites dar neturi sutvarkytų problemų.`,
    cats[0] ? `Daugiausia pranešimų – ${cats[0].name.toLowerCase()}.` : "",
    `Per 8 savaites susikaupė ${count(backlog, ["neišspręsta problema", "neišspręstos problemos", "neišspręstų problemų"])}, skirtumas tarp gautų ir išspręstų ${growing ? "auga" : "nedidėja"}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className="city-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/city" className="city-kicker" style={{ textDecoration: "none" }}>
              ← Visas miestas
            </Link>
            <span className="hint">Paskutinės 8 savaitės</span>
          </div>
          <h1 className="city-title">{district.name}</h1>
        </div>
        <nav aria-label="Pasirinkti rajoną" className="district-tabs">
          {districts.map((d) => (
            <button key={d.id} type="button" aria-pressed={d.id === district.id} onClick={() => navigate(`/city/districts/${d.id}`)}>
              {d.name}
            </button>
          ))}
        </nav>
      </header>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="kpi">
          <span>Gauta pranešimų</span>
          <b>{recent.length}</b>
          <small>per 8 savaites, sujungus dublikatus</small>
        </div>
        <div className="kpi">
          <span>Išspręsta</span>
          <b>{resolvedPct} %</b>
          <span className="bar" style={{ height: 6 }}>
            <i style={{ height: 6, width: `${resolvedPct}%` }} />
          </span>
        </div>
        <div className="kpi">
          <span>Vid. sprendimo laikas</span>
          <b>{days !== null ? `${decimal(days)} d.` : "–"}</b>
          {diff !== null && (
            <span className={`speed ${same ? "same" : faster ? "fast" : "slow"}`}>
              {same ? "=" : faster ? "▼" : "▲"} {speedText}
            </span>
          )}
        </div>
        <div className="kpi">
          <span>Atidaryta iš naujo</span>
          <b>{recent.filter(isReopened).length}</b>
          <small>gyventojai pranešė, kad nesutvarkyta</small>
        </div>
        <div className="kpi dark">
          <span>Aktyvūs gyventojai</span>
          <b>{activeResidents(recent)}</b>
          <small>{league}. vieta rajonų varžytynėse</small>
        </div>
      </div>

      <div className="city-row">
        <section className="ccard" style={{ flex: "999 1 560px", gap: 14 }}>
          <div className="sec-head" style={{ gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h2>Gauta per savaitę – kokioje stadijoje dabar</h2>
              <span className="hint" style={{ fontSize: 13 }}>
                {insight}
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {STAGES.map((s) => (
                <span key={s.id} className="stage-key">
                  <i style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
              <div className="toggle" role="group" aria-label="Rodinys">
                <button type="button" aria-pressed={!table} onClick={() => setTable(false)}>
                  Grafikas
                </button>
                <button type="button" aria-pressed={table} onClick={() => setTable(true)}>
                  Lentelė
                </button>
              </div>
            </div>
          </div>

          {table ? (
            <div className="ctable-wrap">
              <table className="ctable" style={{ minWidth: 640, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Savaitė</th>
                    <th className="num">Gauta</th>
                    {STAGES.map((s) => (
                      <th key={s.id} className="num">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.start}>
                      <td>{shortDate(w.start + DAY)}</td>
                      <td className="num">{w.views.length}</td>
                      {STAGES.map((s) => (
                        <td key={s.id} className="num">
                          {w.counts[s.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="wk-chart">
              <div className="wk-axis" aria-hidden="true">
                <span>{top}</span>
                <span>{top / 2}</span>
                <span>0</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wk-plot">
                  <div className="wk-grid" style={{ top: 6 }} />
                  <div className="wk-grid" style={{ top: 116 }} />
                  <div className="wk-grid base" style={{ top: 226 }} />
                  <div className="wk-cols">
                    {weeks.map((w, i) => (
                      <WeekColumn key={w.start} week={w} top={top} index={i} hovered={hover === i} onHover={setHover} />
                    ))}
                  </div>
                </div>
                <div className="wk-labels">
                  {weeks.map((w) => (
                    <span key={w.start}>{shortDate(w.start + DAY)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="ccard" style={{ flex: "1 1 340px", gap: 14 }}>
          <h2>Dažniausios problemos</h2>
          {cats.length ? (
            cats.map((c) => (
              <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500 }}>
                  <span>{c.name}</span>
                  <b>{c.n}</b>
                </div>
                <span className="bar" style={{ height: 10, borderRadius: 5 }}>
                  <i style={{ height: 10, borderRadius: 5, width: `${Math.round((c.n / catMax) * 100)}%` }} />
                </span>
              </div>
            ))
          ) : (
            <p className="hint">Per 8 savaites pranešimų nebuvo.</p>
          )}
        </section>
      </div>

      <div className="city-row">
        <section className="ccard" style={{ flex: "999 1 560px" }}>
          <h2>Ilgiausiai laukiančios problemos</h2>
          {waiting.length ? (
            <ol className="waiting">
              {waiting.map((v) => (
                <li key={v.id}>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{v.title}</span>
                    <span className="hint">{v.address || v.district}</span>
                  </span>
                  <span className="waiting-days">laukia {Math.floor(v.ageDays)} d.</span>
                  <Link className="city-btn sm ghost" to={`/city/problems/${v.id}`}>
                    Atidaryti
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">Neišspręstų problemų nėra.</p>
          )}
        </section>

        <section className="ccard summary-card" style={{ flex: "1 1 340px" }}>
          <h2>Kaip sekasi rajonui?</h2>
          <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>{summary}</span>
          <span className="tag lime" style={{ alignSelf: "flex-start" }}>
            Atnaujinama realiu laiku
          </span>
        </section>
      </div>
    </>
  );
}
