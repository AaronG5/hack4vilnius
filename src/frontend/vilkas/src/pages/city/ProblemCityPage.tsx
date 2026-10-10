// Board 10 · Problemos kortelė ir priskyrimas institucijoms.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, updateProblemStatus } from "../../api";
import { LazyMap } from "../../components/map/LazyMap";
import { BackIcon } from "../../components/icons";
import { INSTITUTIONS, suggestedInstitution } from "../../data/institutions";
import { activeResidents, duplicatesMerged, scoreTone, trend } from "../../lib/cityStats";
import { ago, count, shortDate } from "../../lib/format";
import { URGENCIES_DESC, URGENCY_LABEL } from "../../lib/labels";
import { store, type Assignment } from "../../lib/localStore";
import type { ProblemView } from "../../lib/problemModel";
import { useAppState } from "../../state/appState";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const DUES: { id: string; label: string; ms: number }[] = [
  { id: "24h", label: "24 val.", ms: DAY },
  { id: "3d", label: "3 d.", ms: 3 * DAY },
  { id: "7d", label: "7 d.", ms: 7 * DAY },
  { id: "30d", label: "30 d.", ms: 30 * DAY },
];

const DEFAULT_DUE: Record<string, string> = { dangerous_to_life: "24h", urgent: "3d", can_wait: "7d" };

function dateTime(time: number): string {
  const d = new Date(time);
  return `${shortDate(time)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function caseNumber(v: ProblemView): string {
  return `VLK-${new Date(v.created).getFullYear()}-${v.id.replace(/\D/g, "").slice(-5)}`;
}

const PILL: Record<string, [string, string, string]> = {
  unconfirmed: ["Nepatvirtinta · laukia gyventojų", "var(--surface-2)", "var(--ink)"],
  confirmed: ["Nauja · laukia priskyrimo", "var(--red)", "#fff"],
  pending: ["Perduota · laukiama, kol priims", "var(--yellow)", "var(--chip-ink)"],
  ongoing: ["Sprendžiama · priskirta", "var(--yellow)", "var(--chip-ink)"],
  completed: ["Sutvarkyta", "var(--green)", "#fff"],
  canceled: ["Atšaukta", "var(--surface-2)", "var(--ink)"],
};

interface HistoryItem {
  at: number;
  color: string;
  title: string;
  sub: string;
}

function history(v: ProblemView, assignment: Assignment | undefined): HistoryItem[] {
  const items: HistoryItem[] = [];
  v.detail.reports.forEach((r, i) => {
    const at = Date.parse(r.created_at);
    items.push(
      i === 0
        ? { at, color: "var(--lav)", title: "Pranešė gyventojas", sub: `${dateTime(at)} · ${r.media.length ? "nuotrauka + aprašymas" : "aprašymas"}` }
        : { at, color: "var(--lav)", title: "Sujungtas dublikatas", sub: `${dateTime(at)} · ${r.user.name || "Gyventojas"}` },
    );
  });
  for (const val of v.detail.validations) {
    const at = Date.parse(val.created_at);
    if (val.media.length) items.push({ at, color: "var(--navy)", title: "Nauja nuotrauka", sub: `${ago(at)} · ${val.is_valid ? "„vis dar yra“" : "„sutvarkyta“"}` });
    else if (val.is_valid) items.push({ at, color: "var(--red)", title: "Patvirtino: vis dar yra", sub: `${ago(at)} · ${val.user.name || "Gyventojas"}` });
    else items.push({ at, color: "var(--green)", title: "Pažymėjo „sutvarkyta“", sub: `${ago(at)} · ${val.user.name || "Gyventojas"}` });
  }
  if (assignment) {
    items.push({
      at: assignment.at,
      color: "var(--yellow)",
      title: `Priskirta: ${assignment.institutions.join(" + ")}`,
      sub: `Jūs · ${ago(assignment.at)} · terminas ${shortDate(assignment.due)}`,
    });
  }
  if (v.isFixed && v.fixedAt) {
    items.push({ at: v.fixedAt, color: "var(--green)", title: "Pažymėta „sutvarkyta“", sub: v.fixWindowOpen ? `${ago(v.fixedAt)} · laukia kaimynų patvirtinimo` : ago(v.fixedAt) });
  }
  if (v.detail.reopened_at) {
    const at = Date.parse(v.detail.reopened_at);
    items.push({ at, color: "var(--red)", title: "Atidaryta iš naujo", sub: `${ago(at)} · gyventojai sako, kad vis dar yra` });
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 7);
}

function FactorRow({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <>
      <span>{label}</span>
      <span className="bar">
        <i style={{ width: `${Math.round(pct)}%`, background: "var(--red)" }} />
      </span>
      <span className="hint" style={{ textAlign: "right" }}>
        {value}
      </span>
    </>
  );
}

export function ProblemCityPage() {
  const { id } = useParams();
  const { views, districts, reload, toast } = useAppState();
  const [assignments, setAssignments] = useState(store.assignments);
  const [now] = useState(() => Date.now());
  const v = views.find((x) => x.id === id);

  if (!v) {
    return (
      <div className="ccard">
        <p>Problema nerasta.</p>
        <Link className="city-btn ghost" to="/city" style={{ alignSelf: "flex-start" }}>
          ← Į prioritetų sąrašą
        </Link>
      </div>
    );
  }

  const status = v.detail.status;
  const assignment = assignments[v.id];
  const assigned = status === "pending" || status === "ongoing" || status === "completed";
  const districtId = districts.find((d) => d.name === v.district)?.id;
  const followers = activeResidents([v]);
  const [pill, pillBg, pillInk] = PILL[status];

  const saveAssignment = (next: Assignment | undefined) => {
    const all = { ...assignments };
    if (next) all[v.id] = next;
    else delete all[v.id];
    setAssignments(all);
    store.setAssignments(all);
  };

  // TODO(api-gap): there is no city-staff login yet. In development the backend
  // lets any session use PUT /problems/{id}/status (CITY_TOOLS_FOR_EVERYONE);
  // otherwise only staff accounts may.
  const statusError = (err: unknown, fallback: string) =>
    err instanceof ApiError && (err.status === 401 || err.status === 403)
      ? "Reikia savivaldybės darbuotojo paskyros"
      : fallback;

  const assign = async (a: Assignment) => {
    try {
      await updateProblemStatus(v.id, { status: "pending" });
      saveAssignment(a);
      await reload();
      toast(`Užduotis išsiųsta: ${a.institutions.join(" + ")}`);
    } catch (err) {
      toast(statusError(err, "Nepavyko priskirti – pabandykite dar kartą"));
    }
  };

  // The executor's side, done from here until institutions have their own access.
  const advance = async (next: "ongoing" | "completed") => {
    try {
      await updateProblemStatus(v.id, { status: next });
      await reload();
      toast(next === "ongoing" ? "Pažymėta: vykdytojas priėmė" : "Pažymėta: sutvarkyta. Gyventojai gavo pranešimą");
    } catch (err) {
      toast(statusError(err, "Nepavyko – pabandykite dar kartą"));
    }
  };

  const reassign = async () => {
    try {
      await updateProblemStatus(v.id, { status: "confirmed" });
      saveAssignment(undefined);
      await reload();
    } catch (err) {
      toast(statusError(err, "Nepavyko – pabandykite dar kartą"));
    }
  };

  // Photos: newest first; the board shows one large and two small.
  const photos = v.photos.slice().reverse();
  const descriptions = v.detail.reports.map((r) => r.description).filter(Boolean);
  // Residents who wrote more than their yes/no answer.
  const accounts = v.detail.validations.filter((a) => a.description.trim());
  const merged = duplicatesMerged(v);
  const mx = Math.max(1, v.urgVotes);
  const severity = v.urgency === "dangerous_to_life" ? 3 : v.urgency === "urgent" ? 2 : 1;
  const ai = v.detail.reports[0]?.ai_category_suggestion;
  const [lng, lat] = v.detail.location.coordinates;
  const locPin = [{ id: v.id, at: v.at, status: v.status, title: v.title, score: v.score }];

  const assignedNames = assignment?.institutions.join(" + ") ?? v.detail.institution?.name ?? "vykdytojas";
  const dueText = assignment ? shortDate(assignment.due) : null;
  const citizenView = v.isFixed
    ? `„Sutvarkyta – ${assignedNames}.“ Žymė žemėlapyje tapo žalia, o ${v.noVotes} kaimynų jau atsakė, kad problemos nebėra.`
    : assigned
    ?`„Sprendžiama – ${assignedNames}.${dueText ? ` Numatyta iki ${dueText}.` : ""}“ ${count(followers, ["sekėjas gavo", "sekėjai gavo", "sekėjų gavo"])} pranešimą, o žymė žemėlapyje tapo geltona.`
    : `„${status === "unconfirmed" ? "Laukia kaimynų patvirtinimo" : "Patvirtinta, laukia sprendimo"}.“ Kai priskirsite, ${count(followers, ["sekėjas gaus", "sekėjai gaus", "sekėjų gaus"])} pranešimą, o žymė žemėlapyje taps geltona.`;

  return (
    <>
      <header className="city-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <Link to="/city" className="pc-back" aria-label="Grįžti į prioritetų sąrašą">
            <BackIcon size={20} />
          </Link>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span className="hint">
              <Link to="/city">Šios savaitės prioritetai</Link> ·{" "}
              {districtId ? <Link to={`/city/districts/${districtId}`}>{v.district}</Link> : v.district} · Nr. {caseNumber(v)}
            </span>
            <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>{v.title}</h1>
            <span className="hint" style={{ fontSize: 14 }}>
              {v.address || v.district}
              {v.nearSensitive && " · prie mokyklos ar darželio"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="pc-pill" style={{ background: pillBg, color: pillInk }}>
            {pill}
          </span>
          <div className={`pc-score ${scoreTone(v.score)}`}>
            <b>{v.score}</b>
            <span>prioritetas</span>
          </div>
        </div>
      </header>

      <div className="city-row" style={{ alignItems: "flex-start", gap: 18 }}>
        <div style={{ flex: "999 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="ccard pc-media">
            {photos.length ? (
              photos.slice(0, 3).map((p, i) => (
                <figure key={p.src} className={i === 0 ? "big" : undefined}>
                  <img src={p.src} alt="" />
                  <figcaption>
                    {i === 0 ? "Naujausia · " : ""}
                    {ago(p.at)}
                    {p.kind === "yes" ? " · „problema yra“" : p.kind === "no" ? " · „problemos nėra“" : " · pranešta"}
                  </figcaption>
                </figure>
              ))
            ) : (
              <div className="pc-nophoto">Nuotraukų nėra – pranešta tekstu</div>
            )}
            <p className="pc-desc">
              {descriptions[0] ?? "Aprašymo nėra."}
              {descriptions.length > 1 && <span className="hint"> Aprašymas sujungtas iš {descriptions.length} pranešimų.</span>}
            </p>
            {v.clips.length > 0 && (
              <div className="pc-desc" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Vaizdo ir garso įrašai</span>
                {v.clips.map((clip) =>
                  clip.media === "video" ? (
                    <video key={clip.src} src={clip.src} controls preload="metadata" style={{ width: "100%", maxWidth: 420 }} />
                  ) : (
                    <audio key={clip.src} src={clip.src} controls preload="metadata" style={{ width: "100%", maxWidth: 420 }} />
                  ),
                )}
              </div>
            )}
            {accounts.length > 0 && (
              <div className="pc-desc" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Gyventojų patikslinimai</span>
                {accounts.map((a) => (
                  <span key={a.id} className="hint">
                    „{a.description}“ – {a.is_valid ? "problema yra" : "problemos nėra"}, {ago(Date.parse(a.created_at))}
                  </span>
                ))}
              </div>
            )}
          </section>

          <div className="pc-grid2">
            <section className="ccard">
              <div className="sec-head">
                <h2 style={{ fontSize: 16 }}>Bendruomenės patikra</h2>
                <span className="tag lime">{v.yesVotes} patvirtino</span>
              </div>
              <div className="grid3">
                <div className="pc-stat">
                  <b>{v.yesVotes}</b>„problema yra“
                </div>
                <div className="pc-stat">
                  <b>{v.noVotes}</b>„problemos nėra“
                </div>
                <div className="pc-stat">
                  <b>{merged}</b>sujungti dublikatai
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Skubumas – gyventojų balsai</span>
              <div className="pc-bars" style={{ gridTemplateColumns: "130px 1fr 28px" }}>
                {URGENCIES_DESC.map((u) => (
                  <FactorBar key={u} label={URGENCY_LABEL[u]} pct={(v.tally[u] / mx) * 100} value={String(v.tally[u])} red={u === "dangerous_to_life"} />
                ))}
              </div>
              <span className="hint">
                {count(followers, ["gyventojas", "gyventojai", "gyventojų"])} pranešė arba patikrino. {/* TODO(api-gap): GPS proximity and reporter levels */}
              </span>
            </section>

            <section className="ccard">
              <h2 style={{ fontSize: 16 }}>Kodėl prioritetas {v.score}</h2>
              <div className="pc-bars" style={{ gridTemplateColumns: "150px 1fr 120px" }}>
                <FactorRow label="Patvirtinimai" pct={(Math.min(v.confirms, 10) / 10) * 100} value={String(v.confirms)} />
                <FactorRow label="Skubumas" pct={(severity / 3) * 100} value={URGENCY_LABEL[v.urgency]} />
                <FactorRow label="Jautri vieta" pct={v.nearSensitive ? 100 : 0} value={v.nearSensitive ? "Mokykla" : "–"} />
                <FactorRow label="Amžius" pct={(Math.min(v.ageDays, 14) / 14) * 100} value={`${Math.floor(v.ageDays)} d.`} />
              </div>
              <span className="hint">Tendencija: {trend(v, now) === "up" ? "▲ auga" : "– stabili"}</span>
              {ai && (
                <div className="pc-ai">
                  <span className="tag ai">✦ DI</span>
                  <span>
                    Pranešimo tipą DI atpažino kaip <b>{ai}</b>
                  </span>
                </div>
              )}
            </section>
          </div>

          <div className="pc-grid2">
            <section className="ccard">
              <h2 style={{ fontSize: 16 }}>Vieta</h2>
              <LazyMap label={`Vieta: ${v.address || v.district}`} height={210} still cluster={false} center={v.at} zoom={15} pins={locPin} />
              <span className="hint">
                {v.district} · {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </section>

            <section className="ccard">
              <h2 style={{ fontSize: 16 }}>Istorija</h2>
              <div className="pc-history">
                {history(v, assignment).map((h) => (
                  <div key={`${h.at}-${h.title}`}>
                    <i style={{ background: h.color }} />
                    <span>
                      <b>{h.title}</b>
                      <br />
                      <span className="hint">{h.sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          {assigned ? (
            <SentPanel view={v} assignment={assignment} now={now} onReassign={reassign} onAdvance={advance} />
          ) : (
            <AssignPanel key={v.id} view={v} followers={followers} now={now} onAssign={assign} />
          )}
          <section className="ccard pc-citizen">
            <span className="pc-kicker">Gyventojai mato</span>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{citizenView}</span>
          </section>
        </aside>
      </div>
    </>
  );
}

function FactorBar({ label, pct, value, red }: { label: string; pct: number; value: string; red?: boolean }) {
  return (
    <>
      <span>{label}</span>
      <span className="bar">
        <i style={{ width: `${Math.round(pct)}%`, background: red ? "var(--red)" : undefined }} />
      </span>
      <b style={{ textAlign: "right" }}>{value}</b>
    </>
  );
}

function AssignPanel({ view: v, followers, now, onAssign }: { view: ProblemView; followers: number; now: number; onAssign: (a: Assignment) => Promise<void> }) {
  const suggestion = suggestedInstitution(v.category, v.detail.category.institution?.name);
  const [selected, setSelected] = useState<string[]>(suggestion ? [suggestion] : []);
  const [due, setDue] = useState(DEFAULT_DUE[v.urgency] ?? "7d");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [askPhoto, setAskPhoto] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (name: string) => setSelected((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  const dueMs = DUES.find((d) => d.id === due)!.ms;
  const n = selected.length;
  const label = n ? (n === 1 ? `Priskirti: ${selected[0]}` : `Priskirti ${n} institucijoms`) : "Pažymėkite bent vieną instituciją";

  const submit = async () => {
    setBusy(true);
    // TODO(api-gap): note, deadline and the two toggles have nowhere to go yet; kept locally.
    await onAssign({ institutions: selected, due: now + dueMs, note, at: Date.now() });
    setBusy(false);
  };

  return (
    <section className="ccard" style={{ gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ fontSize: 18 }}>Priskirti vykdytojui</h2>
        <span className="hint" style={{ fontSize: 13 }}>
          Pažymėkite vieną ar kelias institucijas. Pirma pažymėta tampa atsakinga, kitos – bendravykdytojos.
        </span>
      </div>
      {v.detail.status === "unconfirmed" && <div className="note warn">Gyventojai šios problemos dar nepatvirtino. Galite priskirti, bet verta palaukti patvirtinimų.</div>}
      {suggestion && (
        <div className="pc-ai" style={{ background: "rgba(255,159,218,.18)" }}>
          <span className="tag ai">✦ DI siūlo</span>
          <span>
            <b>{suggestion}</b> – pagal kategoriją „{v.category}“
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {INSTITUTIONS.map((it) => {
          const i = selected.indexOf(it.name);
          const on = i >= 0;
          return (
            <button key={it.name} type="button" className="inst" aria-pressed={on} onClick={() => toggle(it.name)}>
              <span className="inst-box">{on ? "✓" : ""}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 14 }}>{it.name}</b>
                  {it.name === suggestion && <span className="inst-tag ai">DI</span>}
                  {on && <span className="inst-tag role">{i === 0 ? "Atsakinga" : "Bendravykdytoja"}</span>}
                </span>
                <span className="hint">{it.scope}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="fld">
        Terminas · pasiūlytas pagal skubumą „{URGENCY_LABEL[v.urgency].toLowerCase()}“
        <div className="seg" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }} role="group" aria-label="Terminas">
          {DUES.map((d) => (
            <button key={d.id} type="button" aria-pressed={due === d.id} onClick={() => setDue(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <span style={{ fontWeight: 500 }}>Iki {dateTime(now + dueMs)}</span>
      </div>

      <label className="fld">
        Užduoties pastaba vykdytojui
        <textarea className="inp" placeholder="Pvz.: pirmiausia atkurti apšvietimą, ženklinimą atnaujinti iki savaitės pabaigos." value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 500 }}>
        <label className="pc-check">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Pranešti {count(followers, ["sekėjui", "sekėjams", "sekėjų"])}, kai būsena pasikeis
        </label>
        <label className="pc-check">
          <input type="checkbox" checked={askPhoto} onChange={(e) => setAskPhoto(e.target.checked)} />
          Po sutvarkymo paprašyti kaimynų patvirtinti nuotrauka
        </label>
      </div>

      <button type="button" className="btn bright" disabled={!n || busy} onClick={() => void submit()}>
        {busy ? "Siunčiama…" : label}
      </button>
    </section>
  );
}

function SentPanel({
  view: v,
  assignment,
  now,
  onReassign,
  onAdvance,
}: {
  view: ProblemView;
  assignment?: Assignment;
  now: number;
  onReassign: () => Promise<void>;
  onAdvance: (next: "ongoing" | "completed") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const step = async (next: "ongoing" | "completed") => {
    setBusy(true);
    await onAdvance(next);
    setBusy(false);
  };
  const names = assignment?.institutions ?? (v.detail.institution ? [v.detail.institution.name] : []);
  const status = v.detail.status;
  // Eiga: 1 priskirta · 2 priėmė · 3 darbai vyksta · 4 pažymėta sutvarkyta · 5 kaimynai patvirtino.
  const reached = status === "pending" ? 1 : status === "ongoing" ? 3 : v.noVotes >= 2 ? 5 : 4;
  const steps = ["Priskirta", "Vykdytojas priėmė", "Darbai vyksta", "Vykdytojas pažymėjo „sutvarkyta“ + nuotrauka", "Kaimynai atsakė, kad problemos nebėra"];
  const contact = INSTITUTIONS.find((i) => i.name === names[0])?.contact ?? v.detail.institution?.contact_info;

  return (
    <section className="ccard" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pc-done">✓</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 style={{ fontSize: 18 }}>{status === "completed" ? "Sutvarkyta" : "Užduotis išsiųsta"}</h2>
          <span className="hint">
            Nr. {caseNumber(v)}
            {assignment && ` · terminas ${dateTime(assignment.due)}`}
            {assignment && assignment.due < now && status !== "completed" && " · vėluoja"}
          </span>
        </div>
      </div>
      {names.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {names.map((name, i) => (
            <div key={name} className="pc-sent">
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <b style={{ fontSize: 14 }}>{name}</b>
                <span className="hint">
                  {i === 0 ? "Atsakinga" : "Bendravykdytoja"} · {status === "pending" ? "laukiama, kol priims" : status === "ongoing" ? "dirba" : "baigė"}
                </span>
              </span>
              <span className="inst-tag" style={{ background: status === "completed" ? "var(--green)" : "var(--yellow)", color: status === "completed" ? "#fff" : "var(--chip-ink)" }}>
                {status === "pending" ? "Išsiųsta" : status === "ongoing" ? "Priimta" : "Atlikta"}
              </span>
            </div>
          ))}
        </div>
      )}
      {assignment?.note && <div className="note">{assignment.note}</div>}
      <span style={{ fontSize: 13, fontWeight: 700 }}>Eiga</span>
      <ol className="pc-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < reached ? "on" : undefined}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {status !== "completed" && (
        <button type="button" className="btn bright" disabled={busy} onClick={() => void step(status === "pending" ? "ongoing" : "completed")}>
          {status === "pending" ? "Vykdytojas priėmė – pradėti darbus" : "Pažymėti sutvarkyta"}
        </button>
      )}
      {status !== "completed" && (
        <div className="grid3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className="btn ghost" style={{ height: 46 }} onClick={() => void onReassign()}>
            Perskirti
          </button>
          {contact ? (
            <a className="btn" style={{ height: 46 }} href={`mailto:${contact}?subject=${encodeURIComponent(`${caseNumber(v)} ${v.title}`)}`}>
              Rašyti vykdytojui
            </a>
          ) : (
            <button type="button" className="btn" style={{ height: 46 }} disabled>
              Rašyti vykdytojui
            </button>
          )}
        </div>
      )}
    </section>
  );
}
