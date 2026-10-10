// Report flow sheet from the demo (FAB): source → comment → AI → form → place → duplicates → send.
// "Nufotografuoti" is a file input with capture, so tapping it opens the camera directly.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProblemValidation, createReport, type ProblemUrgency } from "../api";
import { CityMap } from "../components/CityMap";
import { CameraIcon, GalleryIcon, MicIcon, PencilIcon } from "../components/icons";
import { Sheet, Steps } from "../components/Sheet";
import { districtOf, mapMeters, toLngLat, type XY } from "../lib/cityMap";
import { analyzeReport } from "../lib/gaps";
import { URGENCIES, URGENCY_LABEL } from "../lib/labels";
import type { ProblemView } from "../lib/problemModel";
import { useAppState } from "../state/appState";

type Step = "source" | "text" | "photoText" | "analyzing" | "form" | "place" | "dupes" | "saving";

interface Form {
  categoryId: string;
  urgency: ProblemUrgency;
  title: string;
  address: string;
  description: string;
  nearSensitive: boolean;
}

interface Candidate {
  view: ProblemView;
  match: number;
  meters: number;
}

const BLANK: Form = { categoryId: "", urgency: "urgent", title: "", address: "", description: "", nearSensitive: false };

export function ReportSheet() {
  const navigate = useNavigate();
  const { categories, districts, views, reload, toast } = useAppState();

  const [step, setStep] = useState<Step>("source");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [text, setText] = useState("");
  const [form, setForm] = useState<Form>(BLANK);
  const [ai, setAi] = useState<{ confidence: number; source: "photo" | "text" }>();
  const [aiNote, setAiNote] = useState("");
  const [xy, setXy] = useState<XY>();
  const [cands, setCands] = useState<Candidate[]>([]);
  const [dupSel, setDupSel] = useState<number | null>(null);
  const aiCtl = useRef<AbortController>(undefined);

  const close = useCallback(() => {
    aiCtl.current?.abort();
    navigate("/map");
  }, [navigate]);

  // Preview URL lives as long as the chosen photo; both are cleaned up on unmount.
  const previewRef = useRef<string>(undefined);
  const setPhoto = (picked?: File) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = picked ? URL.createObjectURL(picked) : undefined;
    setFile(picked);
    setPreview(previewRef.current);
  };
  useEffect(
    () => () => {
      aiCtl.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const onFile = (files: FileList | null) => {
    const picked = files?.[0];
    if (!picked) return;
    setPhoto(picked);
    setStep("photoText");
  };

  const back = () => {
    setPhoto(undefined);
    setStep("source");
  };

  const analyze = async () => {
    if (!file && !text.trim()) {
      toast("Aprašykite problemą arba pridėkite nuotrauką");
      return;
    }
    setStep("analyzing");
    setAiNote("");
    const ctl = new AbortController();
    aiCtl.current = ctl;
    try {
      const r = await analyzeReport(text, Boolean(file), categories, ctl.signal);
      setForm({
        categoryId: r.categoryId,
        urgency: r.urgency,
        title: r.title,
        address: r.address,
        description: r.description,
        nearSensitive: r.nearSensitive,
      });
      setAi({ confidence: r.confidence, source: r.source });
      setAiNote(r.note ?? "");
      setStep("form");
    } catch {
      // Cancelled via "Sustabdyti ir pildyti ranka".
    }
  };

  const stopAI = () => {
    aiCtl.current?.abort();
    setForm({ ...BLANK, description: text });
    setAi(undefined);
    setStep("form");
  };

  const checkDuplicates = () => {
    if (!xy) return;
    const district = districtOf(xy, districts)?.name;
    const found = views
      .filter((v) => !v.isFixed && v.district === district)
      .map((v) => {
        const d = Math.hypot(v.xy[0] - xy[0], v.xy[1] - xy[1]);
        const same = v.detail.category.id === form.categoryId;
        return { view: v, d, match: Math.round((same ? 55 : 15) + (1 - d / 45) * 40), meters: Math.max(5, Math.round(mapMeters(v.xy, xy))) };
      })
      .filter((c) => c.d <= 45 && c.match >= 50)
      .sort((a, b) => b.match - a.match)
      .slice(0, 3);
    if (found.length) {
      setCands(found);
      setDupSel(0);
      setStep("dupes");
    } else {
      void submit();
    }
  };

  const submit = async () => {
    if (!xy) return;
    setStep("saving");
    const title = form.title.trim() || categories.find((c) => c.id === form.categoryId)?.name || "";
    try {
      await createReport({
        description: form.description.trim() || title,
        category: form.categoryId,
        media: file ? [file] : [],
        title,
        address: form.address.trim(),
        location: { type: "Point", coordinates: toLngLat(xy) },
        urgency: form.urgency,
        near_sensitive: form.nearSensitive,
      });
      await reload();
      navigate("/map");
      toast("Pranešimas išsiųstas! +20 tšk.");
    } catch {
      setStep(cands.length ? "dupes" : "place");
      toast("Nepavyko išsiųsti — pabandykite dar kartą");
    }
  };

  // Confirming a duplicate = a "still there" answer on the existing problem, with the user's photo.
  const confirmDuplicate = async () => {
    const chosen = dupSel !== null ? cands[dupSel] : undefined;
    if (!chosen) return;
    setStep("saving");
    try {
      const result = await createProblemValidation(chosen.view.id, {
        is_valid: true,
        description: form.description.trim() || "Vis dar yra",
        media: file ? [file] : [],
      });
      await reload();
      navigate(`/problems/${chosen.view.id}`);
      toast(`Ačiū, patvirtinta! +${result.points_awarded} tšk.`);
    } catch {
      setStep("dupes");
      toast("Nepavyko išsaugoti — pabandykite dar kartą");
    }
  };

  const textArea = (label: string, placeholder: string) => (
    <label className="fld">
      {label}
      <textarea className="inp" autoFocus placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
    </label>
  );

  let body;
  switch (step) {
    case "source":
      body = (
        <>
          <Steps n={1} />
          <h1>Pranešti apie problemą</h1>
          <p className="lead">Parodykite arba aprašykite — DI užpildys detales, o jūs jas patikrinsite.</p>
          <label className="src">
            <span className="ic" style={{ background: "var(--red)" }}>
              <CameraIcon />
            </span>
            <span>
              <b>Nufotografuoti</b>
              <small>DI atpažins problemą iš nuotraukos — užtenka adreso</small>
            </span>
            <input type="file" accept="image/*" capture="environment" aria-label="Nufotografuoti" onChange={(e) => onFile(e.target.files)} />
          </label>
          <label className="src">
            <span className="ic" style={{ background: "var(--btn)", color: "var(--btn-ink)" }}>
              <GalleryIcon />
            </span>
            <span>
              <b>Įkelti nuotrauką</b>
              <small>Iš telefono galerijos ar kompiuterio</small>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Įkelti nuotrauką" onChange={(e) => onFile(e.target.files)} />
          </label>
          <button type="button" className="src" onClick={() => setStep("text")}>
            <span className="ic" style={{ background: "var(--green)" }}>
              <PencilIcon size={22} />
            </span>
            <span>
              <b>Aprašyti tekstu</b>
              <small>Negalite fotografuoti, pvz., autobuse? Nuotrauką pridėsite vėliau</small>
            </span>
          </button>
          <div className="src" aria-disabled="true">
            <span className="ic" style={{ background: "var(--lav)", color: "var(--chip-ink)" }}>
              <MicIcon size={22} />
            </span>
            <span>
              <b>Vaizdo ir garso įrašai</b>
              <small>Bus kitoje versijoje</small>
            </span>
          </div>
        </>
      );
      break;

    case "text":
      body = (
        <>
          <Steps n={1} />
          <h1>Aprašykite problemą</h1>
          <p className="lead">Kas, kur ir kaip rimta? DI iš teksto atpažins tipą, skubumą ir adresą.</p>
          {textArea("Aprašymas", "Pvz.: Kalvarijų g. 98 prie stotelės didelė duobė, mašinos ją apvažiuoja")}
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => void analyze()}>
              Atpažinti su DI
            </button>
            <button type="button" className="btn ghost" onClick={back}>
              Atgal
            </button>
          </div>
        </>
      );
      break;

    case "photoText":
      body = (
        <>
          <Steps n={1} />
          <h1>Pridėti komentarą?</h1>
          {preview && <img className="preview" src={preview} alt="Jūsų nuotrauka" />}
          {textArea(
            "Adresas ar komentaras (nebūtina) — problemos tipą DI atpažins iš nuotraukos",
            "Pvz.: Kalvarijų g. 98",
          )}
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => void analyze()}>
              Atpažinti su DI
            </button>
            <button type="button" className="btn ghost" onClick={back}>
              Atgal
            </button>
          </div>
        </>
      );
      break;

    case "analyzing":
      body = (
        <>
          <Steps n={2} />
          {preview && <img className="preview" src={preview} alt="Jūsų nuotrauka" style={{ maxHeight: 150 }} />}
          <div className="spin" role="progressbar" aria-label="DI analizuoja" />
          <h1 style={{ textAlign: "center" }}>{file ? "DI žiūri į nuotrauką…" : "DI atpažįsta problemą…"}</h1>
          <p className="lead" style={{ textAlign: "center" }}>
            {file ? "Nuotraukos analizė trunka iki minutės." : "Tai užtrunka kelias sekundes."}
          </p>
          <button type="button" className="btn ghost" onClick={stopAI}>
            Sustabdyti ir pildyti ranka
          </button>
        </>
      );
      break;

    case "form":
      body = (
        <>
          <Steps n={2} />
          {preview && <img className="preview" src={preview} alt="Jūsų nuotrauka" style={{ maxHeight: 150 }} />}
          {ai && (
            <div className="row" style={{ alignItems: "center" }}>
              <span className="tag ai">✦ DI atpažino {ai.source === "photo" ? "iš nuotraukos" : "iš teksto"}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Tikimybė {ai.confidence} %</span>
            </div>
          )}
          {aiNote && <div className="note warn">{aiNote}</div>}
          <h1>Patikrinkite, ką rado DI</h1>
          <div className="fld" role="group" aria-label="Problemos tipas">
            Problemos tipas — palieskite, jei reikia pataisyti
            <div className="cats">
              {categories.map((c) => (
                <button key={c.id} type="button" className="cat" aria-pressed={form.categoryId === c.id} onClick={() => patch({ categoryId: c.id })}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="fld" role="group" aria-label="Skubumas">
            Skubumas{ai ? " · pasiūlė DI" : ""} — kiti gyventojai galės balsuoti
            <div className="seg">
              {URGENCIES.map((u) => (
                <button key={u} type="button" aria-pressed={form.urgency === u} onClick={() => patch({ urgency: u })}>
                  {URGENCY_LABEL[u]}
                </button>
              ))}
            </div>
          </div>
          <label className="fld">
            Pavadinimas
            <input className="inp" maxLength={60} value={form.title} onChange={(e) => patch({ title: e.target.value })} />
          </label>
          <label className="fld">
            Adresas ar orientyras
            <input className="inp" placeholder="Pvz.: Kalvarijų g. 98" value={form.address} onChange={(e) => patch({ address: e.target.value })} />
          </label>
          <label className="fld">
            Aprašymas
            <textarea className="inp" value={form.description} onChange={(e) => patch({ description: e.target.value })} />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={form.nearSensitive}
              onChange={(e) => patch({ nearSensitive: e.target.checked })}
              style={{ width: 22, height: 22, accentColor: "var(--red)" }}
            />
            Šalia mokyklos, darželio ar ligoninės
          </label>
          <button type="button" className="btn" disabled={!form.categoryId || !form.title.trim()} onClick={() => setStep("place")}>
            Toliau — pažymėti vietą
          </button>
        </>
      );
      break;

    case "place":
      body = (
        <>
          <Steps n={3} />
          <h1>Kur tai?</h1>
          <p className="lead">
            Palieskite žemėlapį ten, kur yra problema.
            {form.address && (
              <>
                {" "}
                Adresas: <b>{form.address}</b>.
              </>
            )}
          </p>
          <CityMap districts={districts} pins={views} onPick={setXy} mark={xy} />
          <p style={{ fontWeight: 600 }}>{xy ? `Rajonas: ${districtOf(xy, districts)?.name ?? "—"}` : "Vieta dar nepažymėta"}</p>
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} disabled={!xy} onClick={checkDuplicates}>
              Toliau
            </button>
            <button type="button" className="btn ghost" onClick={() => setStep("form")}>
              Atgal
            </button>
          </div>
        </>
      );
      break;

    case "dupes":
      body = (
        <>
          <Steps n={4} />
          <span className="tag ai" style={{ alignSelf: "flex-start" }}>
            ✦ Galimas dublikatas
          </span>
          <h1>Ar tai viena iš šių?</h1>
          <p className="lead">Šalia jau yra panašių pranešimų. Patvirtinus esamą, jis greičiau pakils sąraše nei naujas dublikatas.</p>
          <div className="list">
            {cands.map((c, i) => (
              <button key={c.view.id} type="button" className="dup" aria-pressed={dupSel === i} onClick={() => setDupSel(i)}>
                {c.view.thumb ? <img className="thumb" src={c.view.thumb} alt="" /> : <span className="thumb" />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{c.view.title}</b>
                  <br />
                  <span className="sm">
                    {c.view.category} · {c.meters} m · {c.view.confirms} patvirt.
                  </span>
                </span>
                <span className="tag ai">{c.match} %</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn" disabled={dupSel === null} onClick={() => void confirmDuplicate()}>
            Taip — patvirtinti pažymėtą
          </button>
          <button type="button" className="btn link" onClick={() => void submit()}>
            Ne, tai nauja problema
          </button>
        </>
      );
      break;

    case "saving":
      body = (
        <>
          <div className="spin" role="progressbar" aria-label="Siunčiama" />
          <h1 style={{ textAlign: "center" }}>Siunčiama…</h1>
        </>
      );
      break;
  }

  return (
    <Sheet label="Naujas pranešimas" onClose={close}>
      {body}
    </Sheet>
  );
}
