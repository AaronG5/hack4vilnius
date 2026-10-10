// "Naujas iššūkis" from the demo: a private challenge with friends, joined by code.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateCurrentUser } from "../../api";
import { BackIcon } from "../../components/icons";
import { GOALS, type GoalKey } from "../../data/challengeMeta";
import { newChallengeCode } from "../../lib/localStore";
import { useAppState } from "../../state/appState";
import { useChallenges } from "./useChallenges";
import "./challenges.css";

const TARGETS = [5, 10, 20, 50];
const DURATIONS: [number, string][] = [
  [7, "1 sav."],
  [14, "2 sav."],
  [30, "1 mėn."],
];

export function ChallengeCreatePage() {
  const navigate = useNavigate();
  const { me, reload, toast } = useAppState();
  const { privates, savePrivates } = useChallenges();
  const [name, setName] = useState("Draugų iššūkis");
  const [who, setWho] = useState(me?.name ?? "");
  const [goal, setGoal] = useState<GoalKey>("check");
  const [target, setTarget] = useState(10);
  const [dur, setDur] = useState(14);

  const create = async () => {
    const trimmedWho = who.trim();
    if (trimmedWho && trimmedWho !== me?.name) {
      try {
        await updateCurrentUser({ name: trimmedWho });
        await reload();
      } catch {
        // The name is cosmetic here; creating the challenge still works.
      }
    }
    // TODO(api-gap): POST /challenges for private challenges.
    const code = newChallengeCode();
    savePrivates([
      { code, name: name.trim() || "Draugų iššūkis", goal, target, dur, created: Date.now(), ownerName: trimmedWho },
      ...privates,
    ]);
    navigate(`/challenges/p:${code}`, { replace: true });
    toast(`Iššūkis sukurtas – kodas ${code}`);
  };

  return (
    <main className="app-main">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" className="backbtn" aria-label="Atgal į iššūkius" style={{ background: "var(--surface)", color: "var(--ink)" }} onClick={() => navigate("/challenges")}>
          <BackIcon size={20} />
        </button>
        <div>
          <h1 className="pg" style={{ fontSize: 24 }}>
            Naujas iššūkis
          </h1>
          <p className="pgsub" style={{ margin: 0 }}>
            Privatus – su draugais, šeima ar kaimynais
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <label className="fld">
          Pavadinimas
          <input className="inp" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="fld">
          Jūsų vardas (matys draugai)
          <input className="inp" maxLength={24} placeholder="Pvz.: Aistė" value={who} onChange={(e) => setWho(e.target.value)} />
        </label>
        <div className="fld" role="group" aria-label="Ką darome?">
          Ką darome?
          {(Object.keys(GOALS) as GoalKey[]).map((k) => (
            <button key={k} type="button" className="opt" aria-pressed={goal === k} onClick={() => setGoal(k)}>
              <b>{GOALS[k].label}</b>
              <small>{GOALS[k].hint}</small>
            </button>
          ))}
        </div>
        <div className="fld" role="group" aria-label="Tikslas kiekvienam">
          Tikslas kiekvienam
          <div className="seg" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {TARGETS.map((n) => (
              <button key={n} type="button" aria-pressed={target === n} onClick={() => setTarget(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="fld" role="group" aria-label="Trukmė">
          Trukmė
          <div className="seg">
            {DURATIONS.map(([d, label]) => (
              <button key={d} type="button" aria-pressed={dur === d} onClick={() => setDur(d)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, lineHeight: 1.4 }}>
          <span className="tag lime" style={{ flexShrink: 0 }}>
            Privatus
          </span>
          <span>Prisijungti galima tik su jūsų kodu. Dalyviai mato tik vieni kitų vardus ir taškus. Viešus iššūkius skelbia Savivaldybė.</span>
        </div>
        <button type="button" className="btn bright" onClick={() => void create()}>
          Sukurti ir gauti kodą
        </button>
      </div>
    </main>
  );
}
