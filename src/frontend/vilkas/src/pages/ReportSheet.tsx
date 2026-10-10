// Report flow sheet (FAB): compose → AI → form → place → duplicates → send.
// One way in: every report needs a description, which is what AI reads to suggest the type
// before the form shows; photos are strongly encouraged, audio/video optional.
// "Nufotografuoti" is a file input with capture, so tapping it opens the camera directly.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createProblemValidation, createReport, nearbyProblems, searchPlaces, type Place, type ProblemUrgency } from "../api";
import { AttachmentStrip } from "../components/AttachmentStrip";
import { LazyMap } from "../components/map/LazyMap";
import { CameraIcon, GalleryIcon, MicIcon, PinIcon } from "../components/icons";
import { Sheet, Steps } from "../components/Sheet";
import { currentPosition, distanceMeters, districtOf, type Fix, type LngLat } from "../lib/geo";
import { analyzeReport } from "../lib/gaps";
import { URGENCIES, URGENCY_LABEL } from "../lib/labels";
import type { ProblemView } from "../lib/problemModel";
import { MAX_ATTACHMENTS, useAttachments } from "../lib/attachments";
import { useAppState } from "../state/appState";

type Step = "compose" | "analyzing" | "form" | "place" | "dupes" | "saving";

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
  meters: number;
}

/** How far to look for problems this report might duplicate. */
const DUPLICATE_RADIUS_M = 270;
/** A problem of another type is only offered when it's this close. */
const OTHER_TYPE_RADIUS_M = 35;
const MAX_CANDIDATES = 3;

// Address lookup: wait for a pause in typing, and for enough of an address
// to be worth searching for (the API rejects anything shorter).
const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY = 3;
const MAX_MATCHES = 5;

/** Enough text for AI (and the city) to tell what the problem is. */
const MIN_DESCRIPTION = 10;

const BLANK: Form = { categoryId: "", urgency: "urgent", title: "", address: "", description: "", nearSensitive: false };

// GeolocationPositionError codes, named rather than compared as bare numbers.
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function locationError(error: unknown): string {
  // Read `code` off the shape rather than `instanceof GeolocationPositionError`:
  // the global is missing on older Safari, where that would throw.
  const code = typeof error === "object" && error !== null && "code" in error ? Number((error as { code: unknown }).code) : 0;
  if (code === PERMISSION_DENIED) {
    // Browsers refuse geolocation outright on an insecure origin – which is
    // what opening the dev server by LAN address looks like from a phone.
    return window.isSecureContext
      ? "Vietos prieiga uždrausta – leiskite ją naršyklės nustatymuose arba pažymėkite vietą žemėlapyje."
      : "Vietos nustatymas veikia tik saugiu ryšiu (https arba localhost) – pažymėkite vietą žemėlapyje.";
  }
  if (code === TIMEOUT) {
    return "Vietos nustatymas užtruko per ilgai – bandykite dar kartą arba pažymėkite vietą žemėlapyje.";
  }
  return "Nepavyko nustatyti vietos – pažymėkite ją žemėlapyje.";
}

export function ReportSheet() {
  const navigate = useNavigate();
  const { categories, districts, views, reload, toast } = useAppState();

  const [step, setStep] = useState<Step>("compose");
  const [text, setText] = useState("");
  const [form, setForm] = useState<Form>(BLANK);
  // What pre-filled the type: AI's suggested ids (best first) or keywords. The picker shows only the suggestions until "Kiti tipai".
  const [ai, setAi] = useState<{ suggestions: string[]; source: "ai" | "keywords" }>();
  const [allCats, setAllCats] = useState(false);
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
  const { files, add: addFiles, remove: removeFile, previewFor } = useAttachments(MAX_ATTACHMENTS, onFull);

  const close = useCallback(() => {
    aiCtl.current?.abort();
    navigate("/map");
  }, [navigate]);

  useEffect(() => () => aiCtl.current?.abort(), []);

  const placePins = useMemo(() => views.map((v) => ({ id: v.id, at: v.at, status: v.status, title: v.title, score: v.score })), [views]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

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

  const analyze = async () => {
    if (text.trim().length < MIN_DESCRIPTION) {
      toast("Aprašykite problemą bent keliais žodžiais");
      return;
    }
    setStep("analyzing");
    setAiNote("");
    const ctl = new AbortController();
    aiCtl.current = ctl;
    try {
      const r = await analyzeReport(text, categories, ctl.signal);
      setForm({
        categoryId: r.categoryId,
        urgency: r.urgency,
        title: r.title,
        address: r.address,
        description: r.description,
        nearSensitive: r.nearSensitive,
      });
      setAi({ suggestions: r.suggestions, source: r.source });
      setAllCats(false);
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
    setAllCats(false);
    setStep("form");
  };

  // Before filing, offer open problems nearby: the same type within 270 m,
  // another type only when it's right here. The backend ranks them; when it
  // can't be reached, the problems already on the map are searched instead.
  // `from` is the step the user pressed "Toliau" on; a failed send returns them there.
  const checkDuplicates = async (from: Step) => {
    if (!at) return;
    const [lng, lat] = at;
    let near: { id: string; meters: number; category: string }[];
    try {
      const found = await nearbyProblems({ lat, lng, category: form.categoryId || undefined, radius: DUPLICATE_RADIUS_M });
      near = found.map((p) => ({ id: p.id, meters: p.distance_m, category: p.category.id }));
    } catch {
      near = views
        .filter((v) => !v.isFixed)
        .map((v) => ({ id: v.id, meters: Math.round(distanceMeters(v.at, at)), category: v.detail.category.id }))
        .filter((c) => c.meters <= DUPLICATE_RADIUS_M)
        .sort((a, b) => Number(a.category !== form.categoryId) - Number(b.category !== form.categoryId) || a.meters - b.meters);
    }
    const found = near
      .filter((c) => c.category === form.categoryId || c.meters <= OTHER_TYPE_RADIUS_M)
      .flatMap((c) => {
        // Your own and already-answered problems are offered too: the backend
        // joins a same-type report within 25 m to them anyway, so ask first.
        const view = views.find((v) => v.id === c.id);
        return view ? [{ view, meters: Math.max(5, c.meters) }] : [];
      })
      .slice(0, MAX_CANDIDATES);
    if (found.length) {
      setCands(found);
      setDupSel(0);
      setStep("dupes");
    } else {
      void submit(from);
    }
  };

  // `newProblem`: the user said none of the nearby problems is this one.
  const submit = async (from: Step, newProblem = false) => {
    if (!at) return;
    setStep("saving");
    const title = form.title.trim() || categories.find((c) => c.id === form.categoryId)?.name || "";
    try {
      const report = await createReport({
        description: form.description.trim() || title,
        category: form.categoryId,
        media: files,
        title,
        address: form.address.trim(),
        location: { type: "Point", coordinates: at },
        urgency: form.urgency,
        near_sensitive: form.nearSensitive,
        new_problem: newProblem,
      });
      await reload();
      // A report a few metres from an open problem of the same type joins it.
      if (views.some((v) => v.id === report.problem)) {
        navigate(`/problems/${report.problem}`);
        toast("Toks pranešimas čia jau buvo – prisijungėte prie jo! Taškus gausite, kai jis pasitvirtins");
      } else {
        navigate("/map");
        toast("Pranešimas išsiųstas! +20 tšk. gausite, kai kaimynai jį patvirtins");
      }
    } catch {
      setStep(from);
      toast("Nepavyko išsiųsti – pabandykite dar kartą");
    }
  };

  // Confirming a duplicate = answering "the problem is there" on the existing
  // problem, with this reporter's photo, text and urgency.
  const confirmDuplicate = async () => {
    const chosen = dupSel !== null ? cands[dupSel] : undefined;
    if (!chosen) return;
    // One answer per person: a problem you reported or already answered just opens.
    if (chosen.view.mine || chosen.view.myVote !== undefined) {
      navigate(`/problems/${chosen.view.id}`);
      toast("Apie šią problemą jau pranešėte – ji jau sąraše");
      return;
    }
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
      toast(result.points_awarded > 0 ? `Ačiū, patvirtinta! +${result.points_awarded} tšk.` : "Ačiū, patvirtinta! Taškus gausite, kai pasitvirtins");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already answered from another device: show the problem instead.
        await reload();
        navigate(`/problems/${chosen.view.id}`);
        toast("Jūs jau atsakėte apie šią problemą");
        return;
      }
      setStep("dupes");
      toast("Nepavyko išsaugoti – pabandykite dar kartą");
    }
  };

  // Each picker adds to the same attachment list; the value is reset so the same file can be picked again.
  const picker = (accept: string, label: string, capture?: boolean) => (
    <input
      type="file"
      accept={accept}
      multiple={!capture}
      capture={capture ? "environment" : undefined}
      aria-label={label}
      onChange={(e) => {
        addFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );
  const hasPhoto = files.some((f) => f.type.startsWith("image/"));
  const hasClip = files.some((f) => !f.type.startsWith("image/"));
  const described = text.trim().length >= MIN_DESCRIPTION;

  // With AI suggestions the picker offers just those (best first) until the user asks for the rest.
  const suggested = (ai?.suggestions ?? [])
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is (typeof categories)[number] => c !== undefined);
  const shortList = !allCats && suggested.length > 0 && suggested.length < categories.length;
  const pickerCategories = shortList ? suggested : categories;

  let body;
  switch (step) {
    case "compose":
      body = (
        <>
          <Steps n={1} />
          <h1>Pranešti apie problemą</h1>
          <p className="lead">Nufotografuokite ir aprašykite – tipą ir skubumą pasiūlysime, o jūs patikrinsite.</p>
          <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
          {hasPhoto ? (
            <div className="row">
              <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
                <CameraIcon size={18} />
                Dar viena
                {picker("image/*", "Nufotografuoti dar vieną", true)}
              </label>
              <label className="btn ghost" style={{ flex: 1, cursor: "pointer" }}>
                <GalleryIcon size={18} />
                Iš galerijos
                {picker("image/*", "Pridėti nuotraukų iš galerijos")}
              </label>
            </div>
          ) : (
            <>
              <label className="src">
                <span className="ic" style={{ background: "var(--red)" }}>
                  <CameraIcon />
                </span>
                <span>
                  <b>Nufotografuoti</b>
                  <small>Su nuotrauka pranešimas patvirtinamas greičiau</small>
                </span>
                {picker("image/*", "Nufotografuoti", true)}
              </label>
              <label className="src">
                <span className="ic" style={{ background: "var(--btn)", color: "var(--btn-ink)" }}>
                  <GalleryIcon />
                </span>
                <span>
                  <b>Įkelti nuotraukas</b>
                  <small>Kelias iš karto – iš telefono galerijos ar kompiuterio</small>
                </span>
                {picker("image/*", "Įkelti nuotraukas")}
              </label>
            </>
          )}
          <label className="fld">
            Aprašymas
            <textarea
              className="inp"
              required
              placeholder="Pvz.: Kalvarijų g. 98 prie stotelės didelė duobė, mašinos ją apvažiuoja"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label className="src">
            <span className="ic" style={{ background: "var(--lav)", color: "var(--chip-ink)" }}>
              <MicIcon size={22} />
            </span>
            <span>
              <b>{hasClip ? "Pridėti dar įrašą" : "Garso ar vaizdo įrašas"}</b>
              <small>Nebūtina – kai nuotraukos neužtenka: triukšmas, tekantis vanduo, eismas</small>
            </span>
            {picker("audio/*,video/*", "Įkelti garso ar vaizdo įrašų")}
          </label>
          <button type="button" className="btn" disabled={!described} onClick={() => void analyze()}>
            Toliau
          </button>
          {!described && (
            <span className="sm" style={{ textAlign: "center" }}>
              Aprašymas privalomas – bent keli žodžiai, kas ir kur
              {!hasPhoto && ". Nuotrauka nebūtina, bet labai padeda"}
            </span>
          )}
        </>
      );
      break;

    case "analyzing":
      body = (
        <>
          <Steps n={2} />
          <AttachmentStrip files={files} previewFor={previewFor} onRemove={removeFile} />
          <div className="spin" role="progressbar" aria-label="Atpažįstama" />
          <h1 style={{ textAlign: "center" }}>Atpažįstame problemą…</h1>
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
          {ai && !aiNote && (
            <span className="tag ai" style={{ alignSelf: "flex-start" }}>
              {ai.source === "ai" ? "✦ DI pasiūlė tipą pagal aprašymą" : "✦ Pasiūlyta pagal jūsų aprašymą"}
            </span>
          )}
          {aiNote && <div className="note warn">{aiNote}</div>}
          <h1>Patikrinkite detales</h1>
          <div className="fld" role="group" aria-label="Problemos tipas">
            {shortList ? "Problemos tipas – DI siūlo, tinkamiausias pirmas" : "Problemos tipas – palieskite, jei reikia pataisyti"}
            <div className="cats">
              {pickerCategories.map((c) => (
                <button key={c.id} type="button" className="cat" aria-pressed={form.categoryId === c.id} onClick={() => patch({ categoryId: c.id })}>
                  {c.name}
                </button>
              ))}
              {shortList && (
                <button type="button" className="cat" onClick={() => setAllCats(true)}>
                  Kiti tipai ({categories.length - pickerCategories.length})
                </button>
              )}
            </div>
          </div>
          <div className="fld" role="group" aria-label="Skubumas">
            Skubumas{ai ? " · pasiūlytas" : ""} – kiti gyventojai galės balsuoti
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
                {matched.locality && `, ${matched.locality}`} – vietos žymėti nereikės.
              </span>
            )}
            {notFound && !searching && (
              <span style={{ fontWeight: 500 }}>Tokio adreso nerasta – vietą pažymėsite žemėlapyje.</span>
            )}
            {lookupFailed && !searching && (
              <span style={{ fontWeight: 500 }}>Adresų paieška neveikia – vietą pažymėsite žemėlapyje.</span>
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
            onClick={() => (at ? void checkDuplicates("form") : setStep("place"))}
          >
            {at ? "Toliau – peržiūrėti" : "Toliau – pažymėti vietą"}
          </button>
          {at && (
            <button type="button" className="btn link" onClick={() => setStep("place")}>
              Patikslinti vietą žemėlapyje
            </button>
          )}
          {/* Going back re-runs the suggestion on "Toliau", so a changed description is read again. */}
          <button type="button" className="btn link" onClick={() => setStep("compose")}>
            Atgal – nuotraukos ir aprašymas
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
          <p style={{ fontWeight: 600 }}>{at ? `Rajonas: ${districtOf(at, districts)?.name ?? "–"}` : "Vieta dar nepažymėta"}</p>
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} disabled={!at} onClick={() => void checkDuplicates("place")}>
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
                    {c.view.category} · {c.meters} m · {c.view.confirms} patvirt.{c.view.mine ? " · jūsų" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="btn" disabled={dupSel === null} onClick={() => void confirmDuplicate()}>
            Taip – patvirtinti pažymėtą
          </button>
          <button type="button" className="btn link" onClick={() => void submit("dupes", true)}>
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
