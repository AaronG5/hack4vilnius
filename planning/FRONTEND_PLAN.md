# Frontend implementation plan

App: `src/frontend/vilkas` (Vite + React + TypeScript). API client: `src/api/` (from `api/openapi.yaml`).

## References (in order of precedence)

1. **Working demo** — [Vilkas demo](https://claude.ai/artifact/RhShj7wFRDbNKNdA9SbNy5). The resident app replicates its behaviour, layout and copy: header with points, schematic district map + ranked list, report flow and problem details as bottom sheets, challenges, profile with the Vilnius landmark collection, light/dark theme.
2. **Design boards** — [Vilkas — programėlės ekranai](https://claude.ai/artifact/2DKLJHgNoiZoY69icLtmSQ). Used where the demo has nothing: push notifications (board 5) and the municipality dashboards (boards 8–10).

## Principles

- **One slice at a time, viewable at every step.** Each phase ends with a checkpoint: the screens render, match the reference, and every control works or is visibly disabled.
- **Mock first, wire second.** Pages always call the real `src/api` functions. `npm run dev` sends those calls to Django (the dev server proxies `/api` and `/media`); `npm run dev:mocks` (`VITE_API_MOCKS=true`) has [MSW](https://mswjs.io/) intercept them and serve typed fixtures instead — the demo's example problems — for working without a backend. `manage.py seed_demo --with-examples` puts the same data in the real database.
- **API gaps are explicit.** Data the demo needs that `openapi.yaml` lacks is either an optional field marked `TODO(api-gap)` in `src/api/types.ts`, a stand-in in `src/lib/gaps.ts`, or computed client-side (e.g. priority score) — each listed under [API gaps](#api-gaps). Pages fall back gracefully when a gap field is missing.
- Lithuanian UI copy is taken verbatim from the demo.

## Checkpoint routine (every phase)

1. `npm run build` and `npm run lint` pass (from Phase 11 also `npm test`).
2. `npm run dev`; open the phase's screens at phone width (390×844) and at desktop width; check light and dark theme.
3. Compare side by side with the demo (or design board); note deviations in the Progress section.
4. Click through every control.
5. Commit the phase.

---

## Phase 0 — Foundation ✅

Router, MSW mocks for all 25 operations, `useApi` hook, session bootstrap (`ensureSession`), splash route.

## Phase 1 — App shell + Map view · `/map`

- Demo tokens incl. dark theme; app column (max 520px, full height); header: red "vilkas" brand pill, "Vilniaus problemų radaras", lime points chip (from `getCurrentUser().points`).
- Bottom nav (Žemėlapis / Iššūkiai / Profilis), FAB only on the map, top toast.
- Map view: filter chips with counts; "vis dar yra? +10" prompt (or weekly 3/5 card on the "Nepatvirtintos" filter); schematic Vilnius SVG (districts from `listDistricts()` boundaries, roads, Neris, labels) with notched pins; legend; ranked list ("Svarbiausios neišspręstos" etc.) with thumb, district · category · status and priority score.
- Data: `listProblems()` + `getProblem()` per problem → a `ProblemView` model (title, district, confirmations, votes, score, status).

**Checkpoint:** filters change pins, counts, prompt and list; pins and list items open the problem sheet.

## Phase 2 — Report sheet (FAB)

- Step 1 source: **Nufotografuoti opens the camera directly** (`<input capture>` inside the row), Įkelti nuotrauką, Aprašyti tekstu, disabled "Vaizdo ir garso įrašai".
- Photo → "Pridėti komentarą?" (preview + optional address/comment). Text → "Aprašykite problemą".
- Analyzing spinner with "Sustabdyti ir pildyti ranka" → form: AI tag + confidence, category chips, urgency segmented control, title, address, description, "Šalia mokyklos…" checkbox.
- Place: tap the map to mark the spot (district shown) → duplicate candidates (same district, ≤ ~270 m, match %) → confirm existing (= "vis dar yra" validation) or submit new (`createReport`).
- Success: toast "+20 tšk.", points refresh.

**Checkpoint:** photo, upload and text paths all end in a new pin; confirming a duplicate adds a confirmation instead.

## Phase 3 — Problem sheet · `/problems/:id`

- Photo (latest) + "Nuotrauka atnaujinta prieš…", title, address · district, score badge, description, facts list (tipas, skubumas + votes, patvirtinimai, pranešta, jautri vieta, būsena), photo history.
- Notes: own report / your previous answer / "Sprendžia savivaldybė".
- Urgency voting cards with bars; Vis dar yra / Sutvarkyta / Nežinau → `createProblemValidation`. For problems older than a day, ask for a fresh photo first (camera / gallery / Praleisti).

**Checkpoint:** voting updates counts, points and the pin; photo history grows.

## Phase 4 — Notifications (board 5)

- In-app list from `listNotifications()`, `markNotificationRead()`; entry point in the header. Tapping opens the problem sheet.

## Phase 5 — Challenges · `/challenges`, `/challenges/:id`, `/challenges/new`

- Demo list: title + "Dalyvaujate N iš M", seasonal hero, challenge cards with progress, "Sukurti savo iššūkį", friend code (DRG-XXXX), weekly 5-checks card.
- Detail: colored hero, progress, leaderboard, rules, prize, join/leave (`joinChallenge`), private challenge invite code + copy.
- Create: name, your name, goal, target, duration.
- Data: `listChallenges()`, `getChallenge()`, `joinChallenge()`; district table from problem views; private challenges are a gap (local stand-in).

## Phase 6 — Profile · `/profile`

- Avatar initials, level, district, points; red impact card; stats (pranešimai, patikrinimai, patikimumas); badges; **Vilniaus kolekcija** (15 landmark SVGs from the demo, unlocked by acting within reach); partner prizes; "Mano pranešimai".
- Data: `getCurrentUser()`, `getCurrentUserBadges()`, problem views; editing the name uses `updateCurrentUser()`.

## Phase 7 — Municipality dashboard (board 8) · `/city`
## Phase 8 — District dashboard (board 9) · `/city/districts/:id`
## Phase 9 — Problem card + assignment (board 10) · `/city/problems/:id`

As designed on the boards (filters, KPI tiles, priority table, district charts, institution assignment → `updateProblemStatus`). Desktop layout.

## Phase 10 — Real map

MapLibre GL JS + OpenFreeMap vector tiles (OpenStreetMap data), lazy-loaded. The OSM credit is a license requirement, so it stays as a collapsed "ⓘ" button. Real Vilnius seniūnijos and real fixture coordinates replace the schematic map.

## Phase 11 — API client tests

- Vitest + MSW (node), reusing the Phase 0 handlers.
- `client.ts`: base URL + query building (skips `undefined`/`null`), `Authorization: Token …` only when a token exists, JSON vs `FormData` bodies (no manual multipart `Content-Type`), 204 → `undefined`, non-JSON bodies, `ApiError` status and `detail`, token fallback when `localStorage` throws.
- One test per endpoint function: method, path (encoded id), query/body shape, typed response.
- `session.ts`: `createSession`/`login` store the token, `logout` clears it even on failure, `ensureSession` dedupes concurrent calls.
- Multipart: `createReport`/`createProblemValidation` send each file under `media`, omit absent optional fields.
- Contract check: a script that walks `api/openapi.yaml` and fails if an operation has no client function.
- Optional live smoke test against `manage.py runserver` (the default target; `npm run dev:mocks` is the mocked one).

---

## API gaps

Decision (2026-10-10): gaps stay listed here and stubbed in the frontend; they are addressed together once all phases are done.

| Need | Where | Frontend today | Suggested API |
|---|---|---|---|
| Title, address, "near school" | everywhere | optional gap fields on `ReportCreate` / `Problem`; fall back to category / coordinates | add to `ReportCreate` and `Problem` |
| Urgency chosen when reporting | report sheet | optional `urgency` on `ReportCreate` | add field |
| Priority score | map list, sheet, dashboard | computed client-side (`src/lib/priority.ts`, the demo formula) | `priority_score` + factors on `Problem` |
| List summaries | map list | `getProblem()` per problem | title, thumb, confirmation counts in `GET /problems` |
| AI analysis before submit | report sheet | keyword stand-in in `src/lib/gaps.ts` | `POST /reports/analyze` |
| Reverse geocoding (point → address) | report sheet, after picking on the map or using GPS | the district stands in for a street | extend `GET /geocode` with a point → address lookup |
| Notification title vs body, deep-link target | notifications | split `message` at the first sentence | `title` + `body` on `Notification` |
| Private challenges, join by code | challenges | browser-local stand-in | `POST /challenges`, `POST /challenges/join-by-code`, leaderboard on `ChallengeDetail` |
| Partner prizes + redeem | profile | static list | `GET /rewards`, `POST /rewards/{id}/redeem` |
| Status history (completed_at) | district dashboard | resolve time uses `updated_at` | `GET /problems/{id}/history` or `completed_at` |
| City KPIs, district stats | dashboards | fixtures | `GET /stats/city`, `GET /districts/{id}/stats` |
| City staff login / role check | dashboards | city pages use the anonymous session | auth for `city_administrator` |
| Institutions + assignment | board 10 | fixtures | `GET /institutions`, `POST /problems/{id}/assignments` |
| District of a problem | map list, dashboards | computed client-side (`districtOf`); `GET /problems?district=` matches nothing | implement `districts.services.get_district_for_point` (stub) |
| Points for reporting/answering | header chip, profile | `points_awarded` from the response; `User.points` stays 0 on the real API | credit `User.points` when a report or validation is accepted |

## Maybe later

Ideas parked until the frontend phases are done; none are commitments.

- **Self-hosted map tiles** — OpenFreeMap has no SLA; for production the city could host the same tiles (or switch to a paid provider) by changing only the style URL in `VilniusMap.tsx`.
- **Historical sample data** — seed the mock API with a few dozen older (mostly fixed) problems so the district charts and resolve-time KPIs look realistic. Trade-off: extra green pins on the resident map. Decided 2026-10-10: not now, no fabricated data.
- **Institution workload** — "N aktyvių užduočių · vid. X d." under each institution in the municipality assign step (design board 10). Removed 2026-10-10 because the numbers were made up; bring back once the API reports active tasks and average resolve time per institution.

## Progress

- [x] Phase 0 — Foundation
- [x] Phase 1 — App shell + Map view
  - Matches the demo screenshot for screenshot (light + dark). The demo's "Pavyzdžiai" toggle is omitted: sample data comes from the mock API.
- [x] Phase 2 — Report sheet
  - Camera opens straight from "Nufotografuoti" (no separate capture page).
  - AI step is a keyword stand-in (`src/lib/gaps.ts`); photo recognition waits for the backend and says so in the form.
  - Confirming a duplicate sends a "still there" validation with the user's photo (the demo dropped the photo).
- [x] Phase 3 — Problem sheet
  - For problems older than a day, the answer is sent together with the optional fresh photo (one validation instead of two).
  - "Nežinau" is not sent to the API (no field for it).
- [x] Phase 4 — Notifications
  - Header bell with unread count → `/notifications` (board 5 cards in-app). Tapping marks read and opens the problem sheet.
  - Headline/body are split from the single `message` string.
- [x] Phase 5 — Challenges
  - Leaving a public challenge and private challenges are browser-local; joining by a friend's code shows a "not yet available" message.
- [x] Phase 6 — Profile
  - Landmark icons come from the demo (`src/data/landmarks.json`); "Naujas ženklelis" toast when an action unlocks one.
  - Badges are computed client-side like the demo, not from `GET /users/me/badges`.
- [x] Phase 7 — Municipality dashboard
  - `/city`: filters (district, category, period) kept in the URL; KPI tiles, hotspot map (size/colour = priority, top-2 districts labelled), ranked table with Priskirti / Atidaryti.
  - All numbers are computed from live problems (`src/lib/cityStats.ts`): trend = recent confirmations, reopened = "still there" answers after completion.
  - Session + shared data moved to `RootLayout` so city pages share them with the resident app.
- [x] Phase 8 — District dashboard
  - `/city/districts/:id`: district tabs, 5 KPI tiles (vs city average), weekly stacked chart with hover/focus tooltip and table toggle, top categories, longest-waiting problems, generated summary.
  - Everything is computed from live problems for the last 8 weeks; average resolve time uses `updated_at` of completed problems as a proxy.
  - The sample data only spans ~2 weeks, so most weekly bars are empty until real history exists.
- [x] Phase 9 — Problem card + assignment
  - `/city/problems/:id`: header (breadcrumbs, case number, status pill, priority), photos + merged description, community check with urgency votes, priority factors (the formula actually used), zoomed location, history from reports/answers.
  - Assigning sets status `pending` ("Perduota vykdytojams"), so the resident pin turns yellow; "Perskirti" sets it back to `confirmed`. The suggestion comes from the category's API institution.
  - Institutions list, deadline, note and notification toggles are stand-ins (`src/data/institutions.ts`, browser-local assignment records). "Rašyti vykdytojui" opens an email.
  - Fixed on the way: the splash replayed when moving from city pages into the resident app.
- [x] Phase 10 — Real map
  - `src/components/map/VilniusMap.tsx`: notched status pins drawn on canvas, clustering (count marker), pulse on unconfirmed, hotspot circles, district outlines, tap-to-pick, "Mano vieta" (geolocation), light/dark style, Lithuanian place names and control labels, two-finger panning on phones.
  - Used on the map page, report "Kur tai?" step, dashboard hotspots and the problem card location.
  - Fixtures now use real coordinates (geocoded with Nominatim) and the 21 real seniūnijos (OSM, simplified); several samples moved to their true districts (e.g. Kalvarijų g. 98 → Šnipiškės).
  - Distances, duplicate radius (270 m) and landmark unlocks (120 m) use real metres.
- [x] Wired to Django (2026-10-10)
  - `npm run dev` now talks to the backend; the MSW mocks moved to `npm run dev:mocks`. The dev server proxies `/media` too, with `changeOrigin: false` so the absolute `Media.file_url` Django builds resolves back through the proxy.
  - `createReport` sends the contract's flat `latitude`/`longitude` instead of a `location` JSON blob (the mock handler reads the same fields now).
  - `media` became optional on `POST /reports` and `POST /problems/{id}/validations` (contract, serializers, tests): the demo's text-only report and one-tap "vis dar yra" answer carry no photo.
  - Endpoints the backend doesn't serve now say so: urgency voting (404) → "Skubumo balsavimas dar neveikia"; assignment on the city pages (403, no staff login) → "Reikia savivaldybės darbuotojo paskyros".
  - A token the API doesn't know (left over from the mock API, or from a reset database) made DRF reject *every* request with 401 — public endpoints included, since it authenticates before checking permissions — which left the report form with no categories and its button disabled. `request()` now drops such a token, starts a fresh anonymous session and retries once; concurrent 401s share the one `POST /session`.
  - `manage.py seed_demo` seeds the reference data (and `--with-examples` the nine example problems), since `GET /categories` / `GET /districts` back the report form and the map.
- [x] Address lookup (2026-10-10)
  - `GET /api/geocode?q=` (new `geocoding` app) proxies Photon, an OpenStreetMap geocoder built for type-ahead, bounded to Vilnius and cached. It runs server-side because those services ask callers to identify themselves and keep rates low, which browser type-ahead can't promise; it needs a session, so the app isn't an open relay.
  - The report form's address field is a combobox: suggestions appear as you type (350 ms debounce, 3 characters minimum), and choosing one sets the report's location. The "Kur tai?" map step is then skipped — "Patikslinti vietą žemėlapyje" still opens it.
  - No match, a failed lookup, or an address typed but never resolved all fall back to the map step, each saying which happened.
- [x] One final answer, with urgency and media (2026-10-10)
  - A validation now carries the resident's urgency vote, so the separate `voteUrgency()` stand-in is gone: `Validation.urgency`, and `Problem.urgency` follows the majority (ties to the more severe). `Problem.reported_urgency` keeps what the first report said, so re-tallying can't drift.
  - `Problem.urgency_votes` and `my_urgency_vote` are real API fields now — the sheet's voting bars are no longer a stand-in.
  - One answer per person per problem, enforced by a unique constraint; a second one is refused with **409**. The migration de-duplicates existing answers first (keeping the newest, which is what the app showed), or `AddConstraint` would fail on any database where somebody changed their mind.
  - An answer can carry several photos **or videos** (up to 5 in the UI), picked from the camera or the gallery, each removable before sending.
  - Problems this user has answered draw a **gray pin** on the map (legend: "Jūs atsakėte") and say so in the ranked list; the sheet's answer buttons and urgency controls are disabled with "Atsakymas galutinis".
  - "Nežinau" still isn't sent, so it doesn't use up the one answer.
- [x] Answers are "is it there?", and they decide the status (2026-10-10)
  - The two answers are **"Problema yra"** and **"Problemos nėra"** — `is_valid` either way, as `planning/ARCHITECTURE.md` always described it. "Sutvarkyta" and "Nežinau" are gone: the first was a different question (the municipality owns that status) and the second was never sent anywhere.
  - Both buttons are the same gray `btn ghost`, side by side: they are worth the same, so neither is dressed up as the expected answer.
  - **Two agreeing answers decide**: two saying it is there set the problem `confirmed`, two saying it isn't set it `canceled` — each needs more answers than the other way. One person decides nothing. A verdict is only promoted, never withdrawn for lack of votes, so a late answer can't undo what a case worker set; and once a problem is `ongoing`/`pending`/`completed`, answers stop moving it (`validations.services.evaluate_problem_validations`, no longer a stub).
  - An answer carries **free text** — "Ką matote?" — meant to say more than the original report did; it is optional (the answer is the `is_valid` flag). Those accounts are listed under "Kaimynų patikslinimai" in the problem sheet and under "Gyventojų patikslinimai" on the municipality's problem card.
  - `Vote` is now `"yes" | "no"` throughout (`stillVotes`/`fixedVotes` → `yesVotes`/`noVotes`), so no screen still says "sutvarkyta" for what is really "problemos nėra".
- [x] Reports carry several photos, videos or audio clips (2026-10-10)
  - The demo's disabled "Vaizdo ir garso įrašai — Bus kitoje versijoje" row is live: video and audio, several at a time. "Įkelti nuotraukas" takes several too, and more can be added on the comment and form steps; each is removable before sending.
  - The backend already accepted this (`media` is a list, `infer_media_type` sorts photo/video/audio); the limit was the single-file UI.
  - Clips are playable where they matter: a "Vaizdo ir garso įrašai" section in the problem sheet and on the municipality's problem card. Before this, anything that wasn't a photo was stored and never shown.
  - The picker is now one shared `useAttachments` hook (`src/lib/attachments.ts`) with `AttachmentStrip`, used by both the report and the answer flows instead of two copies.
- [ ] Phase 11 — API client tests
