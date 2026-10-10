// Challenge detail from the demo: coloured hero, progress, leaderboard, rules, prize, join / invite.

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChallenge } from "../../api";
import { BackIcon } from "../../components/icons";
import { useApi } from "../../hooks/useApi";
import { count } from "../../lib/format";
import { CH_ICON } from "../../data/challengeMeta";
import { useAppState } from "../../state/appState";
import { ChallengeIcon } from "./ChallengesPage";
import { useChallenges } from "./useChallenges";
import "./challenges.css";

const BRIGHT = ["var(--red)", "var(--green)", "var(--lime)"];

export function ChallengeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useAppState();
  const { cards, loading, toggleJoin, privates, savePrivates } = useChallenges();
  const [copied, setCopied] = useState(false);
  const c = cards.find((x) => x.id === id);
  const apiId = c?.apiId;
  const { data: detail } = useApi((signal) => (apiId ? getChallenge(apiId, signal) : Promise.resolve(undefined)), `challenge-${apiId ?? ""}`);
  const back = () => navigate("/challenges");

  if (!c) {
    return (
      <main className="app-main">
        <p className="pgsub" style={{ marginTop: 16 }}>
          {loading ? "Įkeliama…" : "Iššūkis nerastas."}
        </p>
        <button type="button" className="btn ghost" onClick={back}>
          Atgal į iššūkius
        </button>
      </main>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.priv!.code);
    } catch {
      // Clipboard unavailable; the code is visible on screen.
    }
    setCopied(true);
  };

  const leave = () => {
    savePrivates(privates.filter((p) => p.code !== c.priv?.code));
    toast("Iššūkį palikote");
    back();
  };

  return (
    <main className="app-main">
      <div className="chhero" style={{ background: c.color, color: c.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="backbtn" aria-label="Atgal į iššūkius" onClick={back}>
            <BackIcon size={20} />
          </button>
          <small style={{ fontWeight: 600 }}>{c.time}</small>
        </div>
        <span className="chic big">
          <ChallengeIcon path={CH_ICON[c.icon as keyof typeof CH_ICON]} size={30} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", opacity: 0.85 }}>
          {c.tag}
          {detail?.participant_count !== undefined && ` · ${count(detail.participant_count, ["dalyvis", "dalyviai", "dalyvių"])}`}
        </span>
        <h1 style={{ fontSize: 24, lineHeight: 1.15 }}>{c.title}</h1>
        <span style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.92 }}>{c.desc}</span>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
          <span>{c.progLabel}</span>
          <span>{c.city !== undefined ? `${c.city} iš ${(c.target ?? 0).toLocaleString("lt-LT")}` : c.pct !== undefined ? `${c.pct} %` : c.mine}</span>
        </div>
        {c.pct !== undefined && (
          <span className="bar">
            <i style={{ width: `${c.pct}%`, background: c.priv || !BRIGHT.includes(c.color) ? "var(--btn)" : c.color }} />
          </span>
        )}
        {c.city !== undefined && <span className="m">Jūsų indėlis: {c.mine}</span>}
        {c.yours && <span className="m">{c.yours}</span>}
      </div>

      {c.rows.length === 0 && c.boardEmpty && (
        <div className="card" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 className="sec" style={{ margin: 0 }}>
            {c.board}
          </h2>
          <span className="m">{c.boardEmpty}</span>
        </div>
      )}

      {c.rows.length > 0 && (
        <div className="card" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="sec" style={{ margin: "0 0 2px" }}>
            {c.board}
          </h2>
          {c.rows.map(([rank, name, note, value, me]) => (
            <div key={`${rank}-${name}`} className={`lrow${me ? " me" : ""}`}>
              <span className={`rk${rank === "1" ? " first" : me ? " mine" : ""}`}>{rank}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{name}</span>
                {note && (
                  <>
                    <br />
                    <span className="m" style={{ fontSize: 11, fontWeight: 600 }}>
                      {note}
                    </span>
                  </>
                )}
              </span>
              <b>{value}</b>
            </div>
          ))}
        </div>
      )}

      {c.rules.length > 0 && (
        <div className="card" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="sec" style={{ margin: "0 0 2px" }}>
            Kaip dalyvauti
          </h2>
          {c.rules.map((t, i) => (
            <div key={t} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.4 }}>
              <span className="rk" style={{ width: 22, height: 22, fontSize: 11 }}>
                {i + 1}
              </span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{c.prize}</span>
      </div>

      {c.priv ? (
        <>
          <section className="hero" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--on-navy-muted)" }}>
              Pakvieskite draugus
            </span>
            <div className="invite">
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".08em" }}>{c.priv.code}</span>
              <button type="button" className="btn" style={{ height: 36, background: "#fff", color: "#3C3C3C", fontSize: 12 }} onClick={() => void copy()}>
                {copied ? "Nukopijuota ✓" : "Kopijuoti"}
              </button>
            </div>
            <small>Privatus: iššūkio nerodome kitiems — prisijungti galima tik su šiuo kodu. Kol kas iššūkis saugomas tik jūsų naršyklėje.</small>
          </section>
          <button type="button" className="btn ghost" style={{ marginTop: 10, width: "100%" }} onClick={leave}>
            Palikti iššūkį
          </button>
        </>
      ) : (
        c.cta && (
          <button
            type="button"
            className={`btn ${c.joined ? "ghost" : "bright"}`}
            style={{ marginTop: 10, width: "100%", ...(c.joined ? { color: "var(--green)", borderColor: "var(--green)" } : {}) }}
            onClick={() => void toggleJoin(c)}
          >
            {c.joined ? c.cta[1] : c.cta[0]}
          </button>
        )
      )}
    </main>
  );
}
