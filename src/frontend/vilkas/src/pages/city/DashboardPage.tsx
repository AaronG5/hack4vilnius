// Board 8 · Šios savaitės prioritetai – the municipality's prioritised, deduplicated problem list.

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LazyMap } from "../../components/map/LazyMap";
import {
  cityStatus,
  duplicatesMerged,
  inPeriod,
  isReopened,
  needsAssignment,
  PERIODS,
  scoreTone,
  trend,
  type Period,
} from "../../lib/cityStats";
import type { ProblemView } from "../../lib/problemModel";
import { useAppState } from "../../state/appState";

function subline(v: ProblemView): string {
  const parts = [v.address || v.district];
  if (v.nearSensitive) parts.push("prie mokyklos");
  const merged = duplicatesMerged(v);
  if (merged) parts.push(`sujungta ${merged + 1} pranešimų`);
  if (isReopened(v)) parts.push("gyventojai teigia, kad vis dar yra");
  return parts.join(" · ");
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { views, districts, categories } = useAppState();
  const [params, setParams] = useSearchParams();
  const district = params.get("district") ?? "";
  const category = params.get("category") ?? "";
  const period = Number(params.get("period") ?? 30) as Period;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const scoped = views.filter(
    (v) =>
      (!district || v.district === districts.find((d) => d.id === district)?.name) &&
      (!category || v.detail.category.id === category) &&
      inPeriod(v, period),
  );
  const open = scoped.filter((v) => !v.isFixed || isReopened(v));
  const ranked = [...open].sort((a, b) => b.score - a.score);
  const confirmedShare = open.length ? Math.round((open.filter((v) => v.confirms >= 3).length / open.length) * 100) : 0;
  const merged = scoped.reduce((n, v) => n + duplicatesMerged(v), 0);
  const reopened = scoped.filter(isReopened).length;

  // Label the two districts with the highest total priority (as the board does).
  const byDistrict = new Map<string, ProblemView[]>();
  for (const v of open) byDistrict.set(v.district, [...(byDistrict.get(v.district) ?? []), v]);
  const hot = [...byDistrict.entries()]
    .map(([name, list]) => ({ name, list, total: list.reduce((n, v) => n + v.score, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 2);
  // Label each hot district at the average position of its open problems.
  const hotLabels = hot.map(({ name, list }) => ({
    text: name,
    at: [list.reduce((n, v) => n + v.at[0], 0) / list.length, list.reduce((n, v) => n + v.at[1], 0) / list.length] as [number, number],
  }));
  const spots = open.map((v) => ({ id: v.id, at: v.at, status: v.status, title: v.title, score: v.score }));

  const open$ = (id: string) => navigate(`/city/problems/${id}`);
  const firstDistrict = district || districts[0]?.id;

  return (
    <>
      <header className="city-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="city-kicker">Vilkas · Vilniaus miesto savivaldybė</span>
          <h1 className="city-title">Šios savaitės prioritetai</h1>
        </div>
        <div className="city-filters">
          <label>
            Rajonas
            <select className="city-select" value={district} onChange={(e) => setParam("district", e.target.value)}>
              <option value="">Visi rajonai</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kategorija
            <select className="city-select" value={category} onChange={(e) => setParam("category", e.target.value)}>
              <option value="">Visos kategorijos</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Laikotarpis
            <select className="city-select" value={period} onChange={(e) => setParam("period", e.target.value)}>
              {PERIODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {firstDistrict && (
            <Link className="city-btn" to={`/city/districts/${firstDistrict}`}>
              Rajonų skydeliai →
            </Link>
          )}
        </div>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span>Neišspręstos problemos</span>
          <b>{open.length}</b>
          <small>sujungus dublikatus</small>
        </div>
        <div className="kpi">
          <span>Patvirtino bendruomenė</span>
          <b>{confirmedShare} %</b>
          <small>≥ 3 gyventojų patvirtinimai</small>
        </div>
        <div className="kpi">
          <span>Sujungti dublikatai</span>
          <b>{merged}</b>
          <small>pranešimai, priskirti esamoms problemoms</small>
        </div>
        <div className="kpi dark">
          <span>Gyventojų atidaryta iš naujo</span>
          <b>{reopened}</b>
          <small>pažymėta sutvarkyta, bet vis dar pranešama</small>
        </div>
      </div>

      <div className="city-row">
        <section className="ccard" style={{ flex: "1 1 380px" }}>
          <div className="sec-head">
            <h2>Karštieji taškai</h2>
            <span className="hint">dydis = prioritetas</span>
          </div>
          <LazyMap label="Vilniaus žemėlapis su prioritetiniais karštaisiais taškais" height={440} hotspots pins={spots} labels={hotLabels} districts={districts} onOpen={open$} />
        </section>

        <section className="ccard" style={{ flex: "999 1 560px" }}>
          <div className="sec-head">
            <h2>Problemų reitingas</h2>
            <span className="hint pill">
              Prioritetas (0–100) = pavojingumas + patvirtinimai pagal patikimumą + jautri vieta + laukimas + įspėjamieji ženklai
            </span>
          </div>
          {ranked.length ? (
            <div className="ctable-wrap">
              <table className="ctable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Problema</th>
                    <th>Rajonas</th>
                    <th>Balas</th>
                    <th>Patvirt.</th>
                    <th>Tendencija</th>
                    <th>Būsena</th>
                    <th>
                      <span className="sr">Veiksmai</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((v, i) => {
                    const up = trend(v) === "up";
                    const status = cityStatus(v);
                    const assign = needsAssignment(v);
                    return (
                      <tr key={v.id}>
                        <td className="rank">{i + 1}</td>
                        <td>
                          <strong>{v.title}</strong>
                          <br />
                          <span className="sub">{subline(v)}</span>
                        </td>
                        <td>{v.district}</td>
                        <td>
                          <span className={`badge-score ${scoreTone(v.score)}`}>{v.score}</span>
                        </td>
                        <td>{v.confirms}</td>
                        <td className={up ? "trend-up" : "trend-flat"}>{up ? "▲ auga" : "– stabili"}</td>
                        <td>{status === "Atidaryta iš naujo" ? <span className="pill-reopened">{status}</span> : status}</td>
                        <td>
                          <Link className={`city-btn sm${assign ? "" : " ghost"}`} to={`/city/problems/${v.id}`}>
                            {assign ? "Priskirti" : "Atidaryti"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">Pagal pasirinktus filtrus neišspręstų problemų nėra.</p>
          )}
        </section>
      </div>
    </>
  );
}
