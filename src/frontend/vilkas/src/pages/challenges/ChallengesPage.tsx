// Iššūkiai list from the demo: seasonal hero, challenge cards, create, friend code, weekly card.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLeaderboard } from "../../api";
import { CH_ICON } from "../../data/challengeMeta";
import { useApi } from "../../hooks/useApi";
import { ChevronIcon, PlusIcon } from "../../components/icons";
import { weekChecks } from "../../lib/activity";
import { count } from "../../lib/format";
import { useAppState } from "../../state/appState";
import { useChallenges, type ChallengeCard } from "./useChallenges";
import "./challenges.css";

export function ChallengeIcon({ path, size = 24 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function Card({ c, onOpen }: { c: ChallengeCard; onOpen: () => void }) {
  return (
    <button type="button" className="chcard" onClick={onOpen}>
      <span className="chic" style={{ background: c.color, color: c.ink }}>
        <ChallengeIcon path={CH_ICON[c.icon as keyof typeof CH_ICON]} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="tag ex">{c.tag}</span>
          {c.joined && <span className="joined">● Dalyvaujate</span>}
          {c.participants !== undefined && <span className="m">{count(c.participants, ["dalyvis", "dalyviai", "dalyvių"])}</span>}
        </span>
        <b style={{ fontSize: 15, lineHeight: 1.2 }}>{c.title}</b>
        <span className="m">{c.short}</span>
        {c.pct !== undefined && (
          <span className="bar" style={{ height: 5 }}>
            <i style={{ height: 5, width: `${c.pct}%`, background: c.priv ? "var(--btn)" : c.color }} />
          </span>
        )}
      </span>
      <ChevronIcon size={18} style={{ flexShrink: 0, color: "var(--muted)" }} />
    </button>
  );
}

export function ChallengesPage() {
  const navigate = useNavigate();
  const { setFilter, me } = useAppState();
  const { data: board } = useApi((signal) => getLeaderboard({ limit: 1 }, signal), `leaderboard-top-${me?.points ?? 0}`);
  const { cards, acts, loading } = useChallenges();
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");

  const seasonal = cards.find((c) => c.seasonal);
  const list = cards.filter((c) => !c.seasonal);
  const total = cards.length;
  const joinedCount = cards.filter((c) => c.joined).length;
  const week = Math.min(5, weekChecks(acts));

  const joinByCode = () => {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^DRG-[A-Z0-9]{4}$/.test(normalized)) {
      setCodeMsg("Kodas atrodo taip: DRG-XXXX");
      return;
    }
    const own = cards.find((c) => c.priv?.code === normalized);
    if (own) {
      navigate(`/challenges/${own.id}`);
      return;
    }
    // TODO(api-gap): POST /challenges/join-by-code.
    setCodeMsg("Draugų iššūkiai bus pasiekiami, kai serveris palaikys kodus. Kol kas matote tik savo sukurtus.");
  };

  return (
    <main className="app-main">
      <h1 className="pg">Iššūkiai</h1>
      <p className="pgsub" style={{ margin: 0 }}>
        {loading && !total ? "Įkeliama…" : `Dalyvaujate ${joinedCount} iš ${total}`}
      </p>

      {seasonal && (
        <section className="hero" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="tag lime">Sezono iššūkis</span>
            <small>{seasonal.time}</small>
          </div>
          <b style={{ fontSize: 19 }}>{seasonal.title}</b>
          <small>{seasonal.desc}</small>
          <span className="bar" style={{ background: "#5B5F75" }}>
            <i style={{ width: `${seasonal.pct ?? 0}%`, background: "var(--lime)" }} />
          </span>
          <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--on-navy-muted)" }}>
            <span>
              {seasonal.city ?? 0} iš {(seasonal.target ?? 0).toLocaleString("lt-LT")} – visas miestas
            </span>
            <span>
              Jūsų indėlis: <b style={{ color: "#fff" }}>{seasonal.mine}</b>
            </span>
          </span>
          <small style={{ color: "#fff", fontWeight: 600 }}>{seasonal.prize}</small>
        </section>
      )}

      <button type="button" className="chcard" style={{ marginTop: 14 }} onClick={() => navigate("/challenges/leaders")}>
        <span className="chic" style={{ background: "var(--lime)", color: "var(--chip-ink)" }}>
          <ChallengeIcon path="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8" />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <b style={{ fontSize: 15, lineHeight: 1.2 }}>Lyderių lentelė</b>
          <span className="m">
            {board?.me ? `Jūsų vieta: ${board.me.rank} · ${board.me.points} tšk.` : "Surinkite taškų ir patekite į lentelę"}
          </span>
        </span>
        <ChevronIcon size={18} style={{ flexShrink: 0, color: "var(--muted)" }} />
      </button>

      <h2 className="sec" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
        Kiti iššūkiai
      </h2>
      <div className="list">
        {list.map((c) => (
          <Card key={c.id} c={c} onOpen={() => navigate(`/challenges/${c.id}`)} />
        ))}
      </div>

      <button type="button" className="dashbtn" onClick={() => navigate("/challenges/new")}>
        <PlusIcon size={20} />
        Sukurti savo iššūkį
      </button>

      <div className="card" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="fld">
          Turite draugo kodą?
          <span className="row" style={{ flexWrap: "nowrap" }}>
            <input
              className="inp"
              placeholder="DRG-XXXX"
              autoCapitalize="characters"
              style={{ textTransform: "uppercase" }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="button" className="btn" style={{ height: 46 }} onClick={joinByCode}>
              Prisijungti
            </button>
          </span>
        </label>
        {codeMsg && <span className="m">{codeMsg}</span>}
      </div>

      <div className="card wk" style={{ marginTop: 8 }}>
        <span className="wkn">{week}/5</span>
        <span style={{ flex: 1 }}>
          <b>Savaitės iššūkis</b>
          <br />
          <span className="m">Patikrinkite 5 problemas pakeliui · +50 tšk.</span>
        </span>
        <button
          type="button"
          className="btn link"
          style={{ height: 36 }}
          onClick={() => {
            setFilter("new");
            navigate("/map");
          }}
        >
          Tęsti
        </button>
      </div>
    </main>
  );
}
