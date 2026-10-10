// Report flow sheet from the demo (FAB): source → comment → AI → form → place → duplicates → send.
// "Nufotografuoti" is a file input with capture, so tapping it opens the camera directly.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createProblemValidation, createReport, searchPlaces, type Place, type ProblemUrgency } from "../api";
import { AttachmentStrip } from "../components/AttachmentStrip";
import { LazyMap } from "../components/map/LazyMap";
import { CameraIcon, GalleryIcon, MicIcon, PencilIcon, PinIcon } from "../components/icons";
import { Sheet, Steps } from "../components/Sheet";
import { currentPosition, distanceMeters, districtOf, type Fix, type LngLat } from "../lib/geo";
import { analyzeReport } from "../lib/gaps";
import { URGENCIES, URGENCY_LABEL } from "../lib/labels";
import type { ProblemView } from "../lib/problemModel";
import { MAX_ATTACHMENTS, useAttachments } from "../lib/attachments";
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

const DUPLICATE_RADIUS_M = 270;

// Address lookup: wait for a pause in typing, and for enough of an address
// to be worth searching for (the API rejects anything shorter).
const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY = 3;
const MAX_MATCHES = 5;

const BLANK: Form = { categoryId: "", urgency: "urgent", title: "", address: "", description: "", nearSensitive: false };

// GeolocationPositionError codes, named rather than compared as bare numbers.
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function locationError(error: unknown): string {
  // Read `code` off the shape rather than `instanceof GeolocationPositionError`:
  // the global is missing on older Safari, where that would throw.
  const code = typeof error === "object" && error !== null && "code" in error ? Number((error as { code: unknown }).code) : 0;
  if (code === PERMISSION_DENIED) {
    // Browsers refuse geolocation outright on an insecure origin — which is
    // what opening the dev server by LAN address looks like from a phone.
    return window.isSecureContext
      ? "Vietos prieiga uždrausta — leiskite ją naršyklės nustatymuose arba pažymėkite vietą žemėlapyje."
      : "Vietos nustatymas veikia tik saugiu ryšiu (https arba localhost) — pažymėkite vietą žemėlapyje.";
  }
  if (code === TIMEOUT) {
    return "Vietos nustatymas užtruko per ilgai — bandykite dar kartą arba pažymėkite vietą žemėlapyje.";
  }
  return "Nepavyko nustatyti vietos — pažymėkite ją žemėlapyje.";
}

export function ReportSheet() {
  const navigate = useNavigate();
  const { categories, districts, views, reload, toast } = useAppState();

  const [step, setStep] = useState<Step>("source");
  const [text, setText] = useState("");
  const [form, setForm] = useState<Form>(BLANK);
  const [ai, setAi] = useState<{ confidence: number; source: "photo" | "text" }>();
  const [aiNote, setAiNote] = useState("");
  const [at, setAt] = useState<LngLat>();
  // Where the map should move to after "Mano vieta".
  const [focus, setFocus] = useState<LngLat>();
  const [locating, setLocating] = useState(false);
  // The GPS fix behind the address, while it still describes `at`.
  const [fix, setFix] = useState<Fix & { district: string }>();
  const [fixError, setFixError] = useState<string>();
  // Address lookup: suggestions for what is typed, and the one chosen.
  const [matches, setMatches] = useState<Place[]>([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [matched, setMatched] = useState<Place>();
  const [notFound, setNotFound] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  // Address text that already has coordinates, so it isn't searched again.
  const settled = useRef("");
  const [cands, setCands] = useState<Candidate[]>([]);
  const [dupSel, setDupSel] = useState<number | null>(null);
  const aiCtl = useRef<AbortController>(undefined);

  const onFull = useCallback((max: number) => toast(`Daugiausia ${max} failai`), [toast]);
  const { files, add: addFiles, remove: removeFile, clear: clearFiles, previewFor } = useAttachments(MAX_ATTACHMENTS, onFull);
  // The AI stand-in reads photos, not clips.
  const hasImage = files.some((f) => f.type.startsWith("image/"));

  const close = useCallback(() => {
    aiCtl.current?.abort();
    navigate("/map");
  }, [navigate]);

  useEffect(() => () => aiCtl.current?.abort(), []);

  const placePins = useMemo(() => views.map((v) => ({ id: v.id, at: v.at, status: v.status, title: v.title, score: v.score })), [views]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const onFile = (picked: FileList | null) => {
    if (!picked?.length) return;
    addFiles(picked);
    setStep("photoText");
  };

  // Look up what is typed, after a pause. A match means the map step can be
  // skipped; no match (or no geocoder) falls back to placing the pin by hand.
  useEffect(() => {
    const query = form.address.trim();
    // Too short, already placed, or not on the form: nothing to look up.
    if (step !== "form" || query === settled.current || query.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlaces(query, MAX_MATCHES, controller.signal)
        .then((found) => {
          setMatches(found);
          setMatchesOpen(found.length > 0);
          setActiveMatch(-1);
          setNotFound(found.length === 0);
          setLookupFailed(false);
        })
        .catch((error: unknown) => {
          // The map step still works, so say which of the two happened:
          // nothing matched, or the lookup itself is unavailable.
          setMatches([]);
          setNotFound(false);
          setLookupFailed(!(error instanceof DOMException && error.name === "AbortError"));
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.address, step]);

  const editAddress = (text: string) => {
    patch({ address: text });
    if (text.trim().length < MIN_QUERY) {
      setMatches([]);
      setMatchesOpen(false);
      setNotFound(false);
      setLookupFailed(false);
    }
    // The coordinates came from the old text, so they no longer describe it.
    if (matched) {
      setMatched(undefined);
      setAt(undefined);
    }
    settled.current = "";
  };

  const chooseMatch = (place: Place) => {
    settled.current = place.address;
    patch({ address: place.address });
    setAt([place.longitude, place.latitude]);
    setMatched(place);
    setFix(undefined);
    setMatches([]);
    setMatchesOpen(false);
    setNotFound(false);
  };

  const onAddressKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!matchesOpen || !matches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step_ = event.key === "ArrowDown" ? 1 : -1;
      setActiveMatch((i) => (i + step_ + matches.length) % matches.length);
    } else if (event.key === "Enter" && activeMatch >= 0) {
      event.preventDefault();
      chooseMatch(matches[activeMatch]);
    } else if (event.key === "Escape") {
      setMatchesOpen(false);
    }
  };

  // The browser gives coordinates, not a street. Until there is a geocoder
  // (TODO(api-gap): reverse geocoding), the pin carries the precision and the
  // address field gets the district as an orientyras.
  const locateMe = async () => {
    setLocating(true);
    setFixError(undefined);
    try {
      const here = await currentPosition();
      const district = districtOf(here.at, districts)?.name ?? "";
      setAt(here.at);
      setFocus(here.at);
      setFix({ ...here, district });
      setMatched(undefined);
      setMatches([]);
      setMatchesOpen(false);
      setNotFound(false);
      if (!form.address.trim() && district) {
        patch({ address: district });
        settled.current = district;
      }
    } catch (error) {
      setFixError(locationError(error));
    } finally {
      setLocating(false);
    }
  };

  // A spot chosen by hand replaces the fix, so the note can't describe the wrong place.
  const pickPlace = (picked: LngLat) => {
    setAt(picked);
    setFix(undefined);
    setMatched(undefined);
  };

  const back = () => {
    clearFiles();
    setStep("source");
  };

  const analyze = async () => {
    if (!files.length && !text.trim()) {
      toast("Aprašykite problemą arba pridėkite nuotrauką");
      return;
    }
    setStep("analyzing");
    setAiNote("");
    const ctl = new AbortController();
    aiCtl.current = ctl;
    try {
      const r = await analyzeReport(text, hasImage, categories, ctl.signal);
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

  // TODO(api-gap): GET /problems/nearby. Same district within ~270 m; match from category and distance.
  const checkDuplicates = () => {
    if (!at) return;
    const district = districtOf(at, districts)?.name;
    const found = views
      .filter((v) => !v.isFixed && v.district === district)
      .map((v) => {
        const meters = distanceMeters(v.at, at);
        const same = v.detail.category.id === form.categoryId;
        return { view: v, meters: Math.max(5, Math.round(meters)), match: Math.round((same ? 55 : 15) + (1 - meters / DUPLICATE_RADIUS_M) * 40) };
      })
      .filter((c) => c.meters <= DUPLICATE_RADIUS_M && c.match >= 50)
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
    if (!at) return;
    setStep("saving");
    const title = form.title.trim() || categories.find((c) => c.id === form.categoryId)?.name || "";
    try {
      await createReport({
        description: form.description.trim() || title,
        category: form.categoryId,
        media: files,
        title,
        address: form.address.trim(),
        location: { type: "Point", coordinates: at },
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

  // Confirming a duplicate = answering "the problem is there" on the existing
  // problem, with this reporter's photo, text and urgency.
  const confirmDuplicate = async () => {
    const chosen = dupSel !== null ? cands[dupSel] : undefined;
    if (!chosen) return;
    setStep("saving");
    try {
      const result = await createProblemValidation(chosen.view.id, {
        is_valid: true,
        description: form.description.trim(),
        urgency: form.urgency,
        media: files,
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
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Nufotografuoti"
              onChange={(e) => {
                onFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="src">
            <span className="ic" style={{ background: "var(--btn)", color: "var(--btn-ink)" }}>
              <GalleryIcon />
            </span>
            <span>
              <b>Įkelti nuotraukas</b>
              <small>Kelias iš karto — iš telefono galerijos ar kompiuterio</small>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="Įkelti nuotraukas"
              onChange={(e) => {
                onFile(e.target.files);
                e.target.value = "";
              }}
            />
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
          <label className="src">
            <span className="ic" style={{ background: "var(--lav)", color: "var(--chip-ink)" }}>
              <MicIcon size={22} />
            </span>
            <span>
              <b>Vaizdo ir garso įrašai</b>
              <small>Kai nuotraukos neužtenka — triukšmas, tekantis vanduo, eismas</small>
            </span>
            <input
              type="file"
              accept="video/*,audio/*"
              multiple
              aria-label="Įkelti vaizdo ar garso įrašų"
              onChange={(e) => {
                onFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
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
          <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
          <div className="row">
            <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
              <CameraIcon size={18} />
              Dar viena
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Nufotografuoti dar vieną"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
              <GalleryIcon size={18} />
              Pridėti failų
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                aria-label="Pridėti nuotraukų, vaizdo ar garso įrašų"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {textArea(
            "Problemos apibūdinimas",
            "Pvz.: 0.2 metrų diametro kelio duobė.",
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
          <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
          <div className="spin" role="progressbar" aria-label="DI analizuoja" />
          <h1 style={{ textAlign: "center" }}>{hasImage ? "DI žiūri į nuotrauką…" : "DI atpažįsta problemą…"}</h1>
          <p className="lead" style={{ textAlign: "center" }}>
            {hasImage ? "Nuotraukos analizė trunka iki minutės." : "Tai užtrunka kelias sekundes."}
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
          <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
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
          <div className="fld">
            <label htmlFor="report-address">Adresas</label>
            <div className="row" style={{ flexWrap: "nowrap", alignItems: "stretch" }}>
              <input
                id="report-address"
                className="inp"
                style={{ flex: 1, minWidth: 0 }}
                placeholder="Pvz.: Kalvarijų g. 98"
                value={form.address}
                onChange={(e) => editAddress(e.target.value)}
                onKeyDown={onAddressKeys}
                onFocus={() => setMatchesOpen(matches.length > 0)}
                role="combobox"
                aria-expanded={matchesOpen}
                aria-controls="address-matches"
                aria-autocomplete="list"
                aria-activedescendant={activeMatch >= 0 ? `address-match-${activeMatch}` : undefined}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn ghost"
                style={{ height: "auto", padding: "0 14px", flexShrink: 0, fontSize: 14 }}
                disabled={locating}
                onClick={() => void locateMe()}
              >
                <PinIcon size={18} />
                {locating ? "Ieškoma…" : "Mano vieta"}
              </button>
            </div>
            {matchesOpen && matches.length > 0 && (
              <ul className="ac" id="address-matches" role="listbox" aria-label="Rasti adresai">
                {matches.map((place, i) => (
                  <li
                    key={`${place.address}-${place.latitude}-${place.longitude}`}
                    id={`address-match-${i}`}
                    role="option"
                    aria-selected={i === activeMatch}
                    className={i === activeMatch ? "ac-item on" : "ac-item"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseMatch(place)}
                  >
                    <b>{place.address}</b>
                    {place.locality && <small>{place.locality}</small>}
                  </li>
                ))}
              </ul>
            )}
            {searching && <span style={{ fontWeight: 500 }}>Ieškoma adreso…</span>}
            {matched && (
              <span style={{ fontWeight: 500 }}>
                ✓ Rasta: {matched.address}
                {matched.locality && `, ${matched.locality}`} — vietos žymėti nereikės.
              </span>
            )}
            {notFound && !searching && (
              <span style={{ fontWeight: 500 }}>Tokio adreso nerasta — vietą pažymėsite žemėlapyje.</span>
            )}
            {lookupFailed && !searching && (
              <span style={{ fontWeight: 500 }}>Adresų paieška neveikia — vietą pažymėsite žemėlapyje.</span>
            )}
            {fix && (
              <span style={{ fontWeight: 500 }}>
                Vieta nustatyta{fix.district && `: ${fix.district}`} · {fix.at[1].toFixed(5)}, {fix.at[0].toFixed(5)} (±{Math.round(fix.accuracy)} m).
                Patikslinti galėsite kitame žingsnyje.
              </span>
            )}
            {fixError && <span className="note warn">{fixError}</span>}
          </div>
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
          <button
            type="button"
            className="btn"
            disabled={!form.categoryId || !form.title.trim()}
            onClick={() => (at ? checkDuplicates() : setStep("place"))}
          >
            {at ? "Toliau — peržiūrėti" : "Toliau — pažymėti vietą"}
          </button>
          {at && (
            <button type="button" className="btn link" onClick={() => setStep("place")}>
              Patikslinti vietą žemėlapyje
            </button>
          )}
        </>
      );
      break;

    case "place":
      body = (
        <>
          <Steps n={3} />
          <h1>Kur tai?</h1>
          <p className="lead">
            Palieskite žemėlapį ten, kur yra problema, arba paspauskite „Mano vieta“.
            {form.address && (
              <>
                {" "}
                Adresas: <b>{form.address}</b>.
              </>
            )}
          </p>
          <LazyMap
            label="Pažymėkite problemos vietą"
            height={300}
            pins={placePins}
            onPick={pickPlace}
            mark={at}
            onLocate={(here) => {
              pickPlace(here);
              setFocus(here);
            }}
            center={focus}
          />
          <p style={{ fontWeight: 600 }}>{at ? `Rajonas: ${districtOf(at, districts)?.name ?? "—"}` : "Vieta dar nepažymėta"}</p>
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} disabled={!at} onClick={checkDuplicates}>
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
