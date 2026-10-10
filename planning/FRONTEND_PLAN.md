# Frontend implementation plan

App: `src/frontend/vilkas` (Vite + React + TypeScript). API client: `src/api/` (from `api/openapi.yaml`).

## References (in order of precedence)

1. **Working demo** — [Vilkas demo](https://claude.ai/artifact/RhShj7wFRDbNKNdA9SbNy5). The resident app replicates its behaviour, layout and copy: header with points, schematic district map + ranked list, report flow and problem details as bottom sheets, challenges, profile with the Vilnius landmark collection, light/dark theme.
2. **Design boards** — [Vilkas — programėlės ekranai](https://claude.ai/artifact/2DKLJHgNoiZoY69icLtmSQ). Used where the demo has nothing: push notifications (board 5) and the municipality dashboards (boards 8–10).

## Principles

- **One slice at a time, viewable at every step.** Each phase ends with a checkpoint: the screens render, match the reference, and every control works or is visibly disabled.
- **Mock first, wire second.** Pages always call the real `src/api` functions. In development, [MSW](https://mswjs.io/) intercepts them and serves typed fixtures (the demo's example problems), so pages work before the backend endpoints exist. `VITE_API_MOCKS=false` sends calls to Django instead.
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

## Phase 10 — Real map (optional)

Swap the schematic SVG for Leaflet + OSM tiles if the team wants geographic accuracy; the projection in `src/lib/cityMap.ts` is the only place that changes.

## Phase 11 — API client tests

- Vitest + MSW (node), reusing the Phase 0 handlers.
- `client.ts`: base URL + query building (skips `undefined`/`null`), `Authorization: Token …` only when a token exists, JSON vs `FormData` bodies (no manual multipart `Content-Type`), 204 → `undefined`, non-JSON bodies, `ApiError` status and `detail`, token fallback when `localStorage` throws.
- One test per endpoint function: method, path (encoded id), query/body shape, typed response.
- `session.ts`: `createSession`/`login` store the token, `logout` clears it even on failure, `ensureSession` dedupes concurrent calls.
- Multipart: `createReport`/`createProblemValidation` send each file under `media`, omit absent optional fields.
- Contract check: a script that walks `api/openapi.yaml` and fails if an operation has no client function.
- Optional live smoke test against `manage.py runserver` (`VITE_API_MOCKS=false`).

---

## API gaps

Decision (2026-10-10): gaps stay listed here and stubbed in the frontend; they are addressed together once all phases are done.

| Need | Where | Frontend today | Suggested API |
|---|---|---|---|
| Report location | report sheet | optional `location` sent with `ReportCreate` (gap field) | `location` (GeoPoint) on `ReportCreate` |
| Title, address, "near school" | everywhere | optional gap fields on `ReportCreate` / `Problem`; fall back to category / coordinates | add to `ReportCreate` and `Problem` |
| Urgency chosen when reporting | report sheet | optional `urgency` on `ReportCreate` | add field |
| Urgency votes | problem sheet | `voteUrgency()` gap function + `urgency_votes` on `Problem` | `POST /problems/{id}/urgency-votes`, `urgency_votes` on `Problem` |
| Priority score | map list, sheet, dashboard | computed client-side (`src/lib/priority.ts`, the demo formula) | `priority_score` + factors on `Problem` |
| List summaries | map list | `getProblem()` per problem | title, thumb, confirmation counts in `GET /problems` |
| AI analysis before submit | report sheet | keyword stand-in in `src/lib/gaps.ts` | `POST /reports/analyze` |
| Notification title vs body, deep-link target | notifications | split `message` at the first sentence | `title` + `body` on `Notification` |
| Private challenges, join by code | challenges | browser-local stand-in | `POST /challenges`, `POST /challenges/join-by-code`, leaderboard on `ChallengeDetail` |
| Partner prizes + redeem | profile | static list | `GET /rewards`, `POST /rewards/{id}/redeem` |
| City KPIs, district stats | dashboards | fixtures | `GET /stats/city`, `GET /districts/{id}/stats` |
| Institutions + assignment | board 10 | fixtures | `GET /institutions`, `POST /problems/{id}/assignments` |

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
- [ ] Phase 7 — Municipality dashboard
- [ ] Phase 8 — District dashboard
- [ ] Phase 9 — Problem card + assignment
- [ ] Phase 10 — Real map (optional)
- [ ] Phase 11 — API client tests
