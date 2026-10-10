// Problem details sheet from the demo: facts, photo history, urgency voting and
// "Vis dar yra / Sutvarkyta / Nežinau" answers (asking for a fresh photo on older problems).

import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, createProblemValidation, voteUrgency, type ProblemUrgency } from "../api";
import { CameraIcon, GalleryIcon } from "../components/icons";
import { Sheet } from "../components/Sheet";
import { ago, count } from "../lib/format";
import { URGENCIES, URGENCY_HINT, URGENCY_LABEL } from "../lib/labels";
import { scoreClass, STATUS_TEXT, type ProblemView, type Vote } from "../lib/problemModel";
import { useAppState } from "../state/appState";

const VOTE_FORMS: [string, string, string] = ["balsas", "balsai", "balsų"];

export function ProblemSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { views, loaded } = useAppState();
  const close = useCallback(() => navigate("/map"), [navigate]);
  const view = views.find((v) => v.id === id);

  return (
    <Sheet label="Pranešimas" onClose={close}>
      {view ? (
        <ProblemDetails key={view.id} view={view} onClose={close} />
      ) : loaded ? (
        <>
          <p className="lead">Pranešimas nebepasiekiamas.</p>
          <button type="button" className="btn ghost" onClick={close}>
            Uždaryti
          </button>
        </>
      ) : (
        <div className="spin" role="progressbar" aria-label="Įkeliama" />
      )}
    </Sheet>
  );
}

function ProblemDetails({ view: m, onClose }: { view: ProblemView; onClose: () => void }) {
  const { reload, toast } = useAppState();
  const [photoAsk, setPhotoAsk] = useState<Vote | null>(null);
  const [busy, setBusy] = useState(false);
  const [unsure, setUnsure] = useState(false);

  const submitVote = async (vote: Vote, file?: File) => {
    const first = !m.myVote;
    setBusy(true);
    try {
      const result = await createProblemValidation(m.id, {
        is_valid: vote === "still",
        description: vote === "still" ? "Vis dar yra" : "Sutvarkyta",
        media: file ? [file] : [],
      });
      await reload();
      setPhotoAsk(null);
      if (!first) toast("Atsakymas pakeistas");
      else if (file) toast(`Nuotrauka atnaujinta! +${result.points_awarded} tšk.`);
      else toast(`${vote === "still" ? "Ačiū, patvirtinta!" : "Ačiū už patikrinimą!"} +${result.points_awarded} tšk.`);
    } catch (err) {
      toast(err instanceof ApiError && err.status === 413 ? "Nuotrauka per didelė — pabandykite kitą" : "Nepavyko išsaugoti — pabandykite dar kartą");
    } finally {
      setBusy(false);
    }
  };

  const answer = (vote: Vote | "unsure") => {
    if (vote === "unsure") {
      setUnsure(true);
      toast("Ačiū!");
      return;
    }
    setUnsure(false);
    // Problems older than a day: ask for a fresh photo before sending the answer.
    if (m.ageDays >= 1) setPhotoAsk(vote);
    else void submitVote(vote);
  };

  const castUrgency = async (urgency: ProblemUrgency) => {
    try {
      await voteUrgency(m.id, { urgency });
      await reload();
      toast(urgency === "dangerous_to_life" ? "Pažymėta: pavojinga gyvybei" : "Ačiū už balsą!");
    } catch {
      toast("Nepavyko išsaugoti — pabandykite dar kartą");
    }
  };

  const onPhoto = (files: FileList | null) => {
    const file = files?.[0];
    if (file && photoAsk) void submitVote(photoAsk, file);
  };

  const history = m.photos.slice().reverse();
  const mx = Math.max(1, m.urgVotes);
  const myAnswer = unsure ? "nežinau" : m.myVote === "still" ? "vis dar yra" : m.myVote === "fixed" ? "sutvarkyta" : null;

  return (
    <>
      {m.thumb && (
        <>
          <img className="preview" src={m.thumb} alt="Naujausia pranešimo nuotrauka" />
          {m.thumbAt && (
            <span className="sm" style={{ marginTop: -8 }}>
              Nuotrauka {m.photos.length > 1 ? "atnaujinta" : "įkelta"} {ago(m.thumbAt)}
            </span>
          )}
        </>
      )}

      {photoAsk && (
        <div className="card" style={{ background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row" style={{ alignItems: "center" }}>
            <span className="tag lime">+10 tšk.</span>
            <span className="tag ex">Pranešta {ago(m.created)}</span>
          </div>
          <h1 style={{ fontSize: 19 }}>
            {photoAsk === "fixed" ? "Parodykite, kaip atrodo sutvarkyta vieta" : "Pridėkite naujausią nuotrauką"}
          </h1>
          <p className="lead">
            {photoAsk === "fixed"
              ? "Nuotrauka padės kitiems greičiau patvirtinti, kad problema išspręsta."
              : "Problema pranešta daugiau nei prieš parą. Nauja nuotrauka parodys savivaldybei, kaip ji atrodo dabar — ar nepablogėjo."}
          </p>
          {busy ? (
            <div className="spin" role="progressbar" aria-label="Įkeliama" />
          ) : (
            <>
              <label className="src" style={{ background: "var(--surface)" }}>
                <span className="ic" style={{ background: "var(--red)" }}>
                  <CameraIcon />
                </span>
                <span>
                  <b>Nufotografuoti dabar</b>
                  <small>Atidaro kamerą telefone</small>
                </span>
                <input type="file" accept="image/*" capture="environment" aria-label="Nufotografuoti dabar" onChange={(e) => onPhoto(e.target.files)} />
              </label>
              <label className="src" style={{ background: "var(--surface)" }}>
                <span className="ic" style={{ background: "var(--btn)", color: "var(--btn-ink)" }}>
                  <GalleryIcon />
                </span>
                <span>
                  <b>Įkelti nuotrauką</b>
                  <small>Ką tik padarytą nuotrauką iš galerijos</small>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Įkelti nuotrauką" onChange={(e) => onPhoto(e.target.files)} />
              </label>
              <button type="button" className="btn link" onClick={() => void submitVote(photoAsk)}>
                Praleisti
              </button>
            </>
          )}
        </div>
      )}

      <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{m.title}</h1>
          <p className="lead" style={{ marginTop: 4 }}>
            {m.address || m.district} · {m.district}
          </p>
        </div>
        <span className={`score ${scoreClass(m)}`} style={{ fontSize: 20, padding: "8px 10px" }}>
          {m.isFixed ? "✓" : m.score}
        </span>
      </div>

      {m.description && <p style={{ lineHeight: 1.5 }}>{m.description}</p>}

      <dl className="kv">
        <dt>Tipas</dt>
        <dd>{m.category}</dd>
        <dt>Skubumas</dt>
        <dd>
          {URGENCY_LABEL[m.urgency]} · {count(m.urgVotes, VOTE_FORMS)}
        </dd>
        <dt>Patvirtinimai</dt>
        <dd>
          {m.confirms}
          {m.fixedVotes > 0 && ` · ${m.fixedVotes} sako „sutvarkyta“`}
        </dd>
        <dt>Pranešta</dt>
        <dd>{ago(m.created)}</dd>
        {m.nearSensitive && (
          <>
            <dt>Vieta</dt>
            <dd>Šalia jautrios vietos</dd>
          </>
        )}
        <dt>Būsena</dt>
        <dd>{STATUS_TEXT[m.status]}</dd>
      </dl>

      {history.length > 1 && (
        <div className="fld">
          Nuotraukų istorija
          <div className="row" style={{ flexWrap: "nowrap", overflowX: "auto", gap: 8, paddingBottom: 4 }}>
            {history.map((p) => (
              <figure key={p.src} style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                <img src={p.src} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: "12px 0 12px 12px" }} />
                <figcaption className="sm" style={{ fontSize: 11 }}>
                  {p.kind === "report" ? "Pranešta" : p.kind === "fixed" ? "Sutvarkyta?" : "Vis dar yra"} · {ago(p.at)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {photoAsk ? (
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void submitVote(photoAsk)}>
          Uždaryti
        </button>
      ) : (
        <>
          {m.mine ? (
            <div className="note">Tai jūsų pranešimas. Kiti gyventojai gali jį patvirtinti arba pažymėti kaip sutvarkytą.</div>
          ) : (
            myAnswer &&
            m.status !== "work" && (
              <div className="note">
                Jūs pažymėjote: <b>{myAnswer}</b>. Galite pakeisti.
              </div>
            )
          )}
          {m.status === "work" && (
            <div className="note" style={{ background: "rgba(255,198,41,.25)" }}>
              <b>Sprendžia savivaldybė.</b> Būseną atnaujina vykdytojas — patvirtinti nereikia. Kai bus sutvarkyta, paprašysime
              kaimynų tai patvirtinti.
            </div>
          )}

          {!m.isFixed && !m.mine && m.status !== "work" && (
            <div className="fld" role="group" aria-label="Kaip skubu?">
              Kaip skubu?{" "}
              {m.myUrg ? "Jūsų balsas pažymėtas — galite pakeisti" : "Balsuokite — tai padeda nuspręsti, ką tvarkyti pirmiausia"}
              <div className="urg">
                {URGENCIES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={k === "dangerous_to_life" ? "life" : undefined}
                    aria-pressed={m.myUrg === k}
                    onClick={() => void castUrgency(k)}
                  >
                    <b>{URGENCY_LABEL[k]}</b>
                    <small>{URGENCY_HINT[k]}</small>
                    <span className="ub">
                      <i style={{ width: `${Math.round((m.tally[k] / mx) * 100)}%` }} />
                    </span>
                    <em>{m.tally[k]}</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!m.mine && m.status !== "work" && (
            <div className="grid3">
              <button type="button" className="btn red" disabled={busy} onClick={() => answer("still")}>
                Vis dar yra
              </button>
              <button type="button" className="btn green" disabled={busy} onClick={() => answer("fixed")}>
                Sutvarkyta
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => answer("unsure")}>
                Nežinau
              </button>
            </div>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Uždaryti
          </button>
        </>
      )}
    </>
  );
}
