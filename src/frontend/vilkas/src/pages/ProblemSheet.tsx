// Problem details sheet from the demo: facts, photo history, and one final answer —
// "Problema yra" or "Problemos nėra", with an optional urgency vote, a longer
// account than the report gave, and any photos or videos backing it. The two
// answers carry equal weight, so they look alike. One answer per person.

import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, createProblemValidation, type ProblemUrgency } from "../api";
import { AttachmentStrip } from "../components/AttachmentStrip";
import { CameraIcon, GalleryIcon } from "../components/icons";
import { Sheet } from "../components/Sheet";
import { ago, count } from "../lib/format";
import { URGENCIES, URGENCY_HINT, URGENCY_LABEL } from "../lib/labels";
import { scoreClass, STATUS_TEXT, type ProblemView, type Vote } from "../lib/problemModel";
import { MAX_ATTACHMENTS, useAttachments } from "../lib/attachments";
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
  // What this answer will carry: an optional urgency vote, a longer account
  // than the report gave, and any files.
  const [urgency, setUrgency] = useState<ProblemUrgency>();
  const [account, setAccount] = useState("");
  const answered = m.myVote !== undefined;

  const onFull = useCallback((max: number) => toast(`Daugiausia ${max} failai`), [toast]);
  const { files, add: addFiles, remove: removeFile, clear: clearFiles, previewFor } = useAttachments(MAX_ATTACHMENTS, onFull);

  const submitVote = async (vote: Vote) => {
    setBusy(true);
    try {
      const result = await createProblemValidation(m.id, {
        is_valid: vote === "yes",
        description: account.trim(),
        urgency,
        media: files,
      });
      clearFiles();
      setAccount("");
      await reload();
      setPhotoAsk(null);
      toast(`Ačiū už patikrinimą! +${result.points_awarded} tšk.`);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 409) {
        // Someone answered from another device, or a double submit.
        await reload();
        toast("Jūs jau atsakėte į šį pranešimą");
      } else {
        toast(status === 413 ? "Failas per didelis — pabandykite kitą" : "Nepavyko išsaugoti — pabandykite dar kartą");
      }
    } finally {
      setBusy(false);
    }
  };

  const answer = (vote: Vote) => {
    if (answered) return;
    // Older than a day and nothing attached yet: ask for a fresh photo first.
    if (m.ageDays >= 1 && files.length === 0) setPhotoAsk(vote);
    else void submitVote(vote);
  };

  const history = m.photos.slice().reverse();
  // Answers that say more than yes/no; the rest are just votes.
  const accounts = m.detail.validations.filter((v) => v.description.trim());
  const mx = Math.max(1, m.urgVotes);
  const myAnswer = m.myVote === "yes" ? "problema yra" : m.myVote === "no" ? "problemos nėra" : null;

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
            {photoAsk === "no" ? "Parodykite, kaip vieta atrodo dabar" : "Pridėkite naujausią nuotrauką"}
          </h1>
          <p className="lead">
            {photoAsk === "no"
              ? "Nuotrauka padės kitiems patikėti, kad problemos šioje vietoje nebėra."
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
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Nufotografuoti dabar"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="src" style={{ background: "var(--surface)" }}>
                <span className="ic" style={{ background: "var(--btn)", color: "var(--btn-ink)" }}>
                  <GalleryIcon />
                </span>
                <span>
                  <b>Įkelti iš galerijos</b>
                  <small>Kelias nuotraukas ar vaizdo įrašą</small>
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  aria-label="Įkelti nuotraukų ar vaizdo įrašų"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
              <button type="button" className="btn" onClick={() => void submitVote(photoAsk)}>
                {files.length > 0 ? `Siųsti atsakymą su ${files.length} failais` : "Praleisti ir atsakyti"}
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
          {m.noVotes > 0 && ` · ${m.noVotes} sako „problemos nėra“`}
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
                  {p.kind === "report" ? "Pranešta" : p.kind === "no" ? "Problemos nėra" : "Problema yra"} · {ago(p.at)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {m.clips.length > 0 && (
        <div className="fld">
          Vaizdo ir garso įrašai
          <div className="list">
            {m.clips.map((clip) => (
              <figure key={clip.src} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {clip.media === "video" ? (
                  <video src={clip.src} controls preload="metadata" style={{ width: "100%", borderRadius: "12px 0 12px 12px" }} />
                ) : (
                  <audio src={clip.src} controls preload="metadata" style={{ width: "100%" }} />
                )}
                <figcaption className="sm" style={{ fontSize: 11 }}>
                  {clip.kind === "report" ? "Pranešta" : clip.kind === "no" ? "Problemos nėra" : "Problema yra"} · {ago(clip.at)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="fld">
          Kaimynų patikslinimai
          <div className="list">
            {accounts.map((a) => (
              <div key={a.id} className="note">
                <b>{a.is_valid ? "Problema yra" : "Problemos nėra"}</b> · {a.user.name || "Gyventojas"} · {ago(Date.parse(a.created_at))}
                <br />
                {a.description}
              </div>
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
                Jūs pažymėjote: <b>{myAnswer}</b>.{" "}
                {answered ? "Atsakymas galutinis — pakeisti nebegalima." : "Galite atsakyti, kai apsispręsite."}
              </div>
            )
          )}
          {m.status === "work" && (
            <div className="note" style={{ background: "rgba(255,198,41,.25)" }}>
              <b>Sprendžia savivaldybė.</b> Būseną atnaujina vykdytojas — patvirtinti nereikia.
            </div>
          )}

          {!m.isFixed && !m.mine && m.status !== "work" && (
            <div className="fld" role="group" aria-label="Kaip skubu?">
              Kaip skubu?{" "}
              {answered
                ? m.myUrg
                  ? "Jūsų balsas suskaičiuotas"
                  : "Atsakėte nebalsavę dėl skubumo"
                : "Pasirinkite — balsas bus išsiųstas kartu su atsakymu"}
              <div className="urg">
                {URGENCIES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={k === "dangerous_to_life" ? "life" : undefined}
                    aria-pressed={answered ? m.myUrg === k : urgency === k}
                    disabled={answered || busy}
                    onClick={() => setUrgency((chosen) => (chosen === k ? undefined : k))}
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

          {!m.mine && m.status !== "work" && !answered && (
            <>
              <label className="fld">
                Ką matote? (nebūtina) — papasakokite plačiau nei pranešime
                <textarea
                  className="inp"
                  maxLength={1000}
                  placeholder="Pvz.: duobė išsiplėtė per visą juostą, vakare jos nesimato"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  disabled={busy}
                />
              </label>

              <div className="fld">
                Nuotraukos ar vaizdo įrašai (nebūtina) — iki {MAX_ATTACHMENTS}
                <div className="row">
                  <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
                    <CameraIcon size={18} />
                    Nufotografuoti
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label="Nufotografuoti"
                      disabled={busy}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
                    <GalleryIcon size={18} />
                    Įkelti
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      aria-label="Įkelti nuotraukų ar vaizdo įrašų"
                      disabled={busy}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
              </div>

              {/* Both answers are worth the same, so neither is dressed up as
                  the expected one. */}
              <div className="row">
                <button type="button" className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => answer("yes")}>
                  Problema yra
                </button>
                <button type="button" className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => answer("no")}>
                  Problemos nėra
                </button>
              </div>
              <span className="sm">
                Patvirtinimai padeda problemą patvirtinti, paneigimai — ją atmesti. Atsakyti galima vieną kartą.
              </span>
            </>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Uždaryti
          </button>
        </>
      )}
    </>
  );
}
