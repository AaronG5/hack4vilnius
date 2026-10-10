# Frontend implementation plan

Source design: [Vilkas — programėlės ekranai](https://claude.ai/artifact/2DKLJHgNoiZoY69icLtmSQ) (14 boards).
App: `src/frontend/vilkas` (Vite + React + TypeScript). API client: `src/api/` (from `api/openapi.yaml`).

## Principles

- **One page at a time, viewable at every step.** Each phase ends with a checkpoint: the page renders in the browser, looks like its design board, and every link/button on it either works or goes to a visible stub.
- **Mock first, wire second.** Pages always call the real `src/api` functions. In development, [MSW](https://mswjs.io/) intercepts those calls and returns typed fixtures, so pages work before the backend endpoints exist. Set `VITE_API_MOCKS=false` to hit Django instead.
- **Design data the API can't provide yet** (priority score, district stats, prizes, landmark collection…) lives in page-local fixtures marked `// TODO(api-gap)`. See [API gaps](#api-gaps).
- Lithuanian UI copy is taken verbatim from the design.

## Checkpoint routine (every phase)

1. `npm run build` and `npm run lint` pass.
2. `npm run dev`, open the phase's routes. Mobile pages are checked at 390×844 (the app renders inside a phone-width column on desktop); municipality pages at 1440 wide.
3. Compare side by side with the design board; note deviations in the phase's checklist.
4. Click every interactive element: it works or navigates to a stub.
5. Commit the phase.

## Design tokens (from the boards)

| Token | Value | Use |
|---|---|---|
| `--red` | `#ED1C24` | Primary, FAB, confirmed markers, active nav |
| `--red-soft` | `rgba(237,28,36,.42)` | Unconfirmed markers `?` |
| `--ink` | `#414454` | Dark buttons, active filter, user location |
| `--text` / `--text-2` | `#3C3C3C` / `#5C5C5C` | Body / secondary text |
| `--lime` | `#BDD947` | Points chips (`+10`) |
| `--yellow` | `#FFC629` | In progress (Sprendžiama) |
| `--green` | `#1C4B1D` | Fixed (Sutvarkyta) |
| `--pink` | `#ED2891` | Video action |
| `--map` / `--surface-2` | `#E4E4E4` / `#EBEBEB` | Map background / option rows |
| Font | Montserrat 400–800 | |
| Shape | `border-radius: R 0 R R` | Signature "notched" corner (top-right square) on cards, buttons, markers |

---

## Phase 0 — Foundation

- Add `react-router-dom`, `msw` (dev).
- Global CSS: tokens, Montserrat, reset, `.notch` radius helpers.
- `AppShell`: phone-width column (max 390px, centered on desktop), `BottomNav` (Žemėlapis / Iššūkiai / Profilis).
- `CityShell`: desktop layout for municipality pages.
- Shared bits: `Logo` (wolf SVG), icon set, `Button`, `Chip`, `PointsBadge`, `Marker`.
- Routes for **all** pages below, each rendering a titled stub.
- MSW setup (`src/mocks/`): browser worker started in `main.tsx` when `VITE_API_MOCKS !== "false"`; typed fixtures for problems, categories, districts, user, challenges, badges, notifications.

**Checkpoint:** every route is reachable from the nav or by URL; stubs show the board name.

## Phase 1 — Splash (board 0) + Map (board 1) · `/`, `/map`

- Splash: red screen, logo, "vilkas", progress bar. Calls `createSession()` if there's no token, then goes to `/map`.
- Map: search bar + filter button, filter chips with counts (Visos / Nepatvirtintos / Sprendžiamos / Sutvarkytos), "vis dar yra?" nearby banner (+10), legend, user dot, markers by status, cluster count marker.
- FAB (80px, red, notched) toggles the report sheet: Nufotografuoti / Nufilmuoti / Įrašyti garsą / Aprašyti tekstu.
- Data: `listProblems({ status })`. Status → marker: `unconfirmed` = soft red `?` (pulsing), `confirmed` = red, `ongoing`/`pending` = yellow, `completed` = green.
- Map is a static SVG backdrop with markers positioned from coordinates (real map tiles in Phase 10).

**Checkpoint:** filters change visible markers and counts; FAB opens/closes the sheet; marker tap opens `/problems/:id` stub.

## Phase 2 — Report flow (boards 2, 3) · `/report/new`, `/report/review`, `/report/duplicates`

- Step 1: capture via `<input type="file" accept="image/*|video/*|audio/*" capture>` or a text-only form, depending on the sheet option.
- Step 2 Review: media preview, "DI atpažino" card, category chips, urgency chips, address row, description textarea (**prompt for a comment if empty**, per AGENTS.md UX requirement), step dots.
- Step 3 Duplicates: summary card, candidate list with match %, "Taip — patvirtinti pažymėtą" / "Ne, tai nauja problema", points note.
- Submit: `createReport({ description, category, problem, media })`; confirming a duplicate sends `problem: <id>`.
- Draft state kept in a `ReportDraft` context across the 3 steps.

**Checkpoint:** full flow from FAB → submitted report → back on map with the new marker (mock).

## Phase 3 — Problem detail (board 4) · `/problems/:id`

- Photo header with media count, title + address, priority score tile, "Kodėl ji N-a rajone" bars, status timeline (`ol`), Patvirtinti / Sekti naujienas.
- Data: `getProblem(id)`; timeline derived from `status` + validations; priority breakdown is an api-gap fixture.

**Checkpoint:** opening different markers shows different problems; "Patvirtinti" goes to the verify flow.

## Phase 4 — Verification (boards 5, 5a, 5b) · `/notifications`, `/problems/:id/verify`, `/problems/:id/verify/photo`

- Notifications: board 5's notification cards rendered as an in-app list from `listNotifications()`; tap → `markNotificationRead()` + navigate.
- Verify: map backdrop, bottom sheet "Ar ši duobė vis dar yra?", urgency vote buttons with counts, Vis dar yra / Sutvarkyta / Nežinau.
- Photo step (only if problem is older than 1 day): photo history strip, Nufotografuoti dabar / Įkelti iš galerijos / Praleisti.
- Submit: `createProblemValidation(id, { is_valid, description, media })`.

**Checkpoint:** banner on the map → verify → photo → back to problem detail showing the new validation.

## Phase 5 — Challenges (board 6) · `/challenges`, `/challenges/:id`, `/challenges/new`

- List: header with points, Aktyvūs / Mano / Baigti tabs, season challenge card with progress, other challenge cards, weekly challenge strip, "Sukurti savo iššūkį", friend code entry.
- Detail: hero, progress, leaderboard, rules, prize, invite block for private challenges, CTA → `joinChallenge(id)`.
- Create: name, goal, target, duration, privacy note (api-gap: no create endpoint).
- Data: `listChallenges()`, `getChallenge(id)`.

**Checkpoint:** open each challenge, join one, its card shows "● Dalyvaujate".

## Phase 6 — Profile (board 7) + Collection (board 7a) · `/profile`, `/profile/collection`

- Profile: avatar initials, level title, district + points, impact card, stats (Pranešimai / Patikrinimai / Patikimumas = `trust_score`), badges row, collection preview, partner prizes.
- Collection: grouped landmark badges, earned vs locked.
- Data: `getCurrentUser()`, `getCurrentUserBadges()`, `listBadges()`; landmarks and prizes are api-gap fixtures. Landmark images in the design are not exportable: use placeholder illustrations until assets are supplied.

**Checkpoint:** numbers on Profile match the mock user; "Visi →" opens the collection.

## Phase 7 — Municipality dashboard (board 8) · `/city`

- Header, filters (Rajonas / Kategorija / Laikotarpis), KPI tiles, hotspots map, priority table with Priskirti / Atidaryti.
- Data: `listProblems({ district, category })`, `listDistricts()`, `listCategories()`; KPIs and score are api-gap fixtures.

**Checkpoint:** filters update the table; rows open `/city/problems/:id`.

## Phase 8 — District dashboard (board 9) · `/city/districts/:id`

- District tabs, KPI tiles vs city average, stacked weekly chart with chart/table toggle, top categories, longest-waiting list, summary.
- Data: `listDistricts()`; stats are api-gap fixtures.

**Checkpoint:** switching tabs changes all numbers; chart and table show the same data.

## Phase 9 — Problem card + assignment (board 10) · `/city/problems/:id`

- Breadcrumbs, title, status pill, priority, media strip, description, community check, urgency votes, priority breakdown, AI note, location, history.
- Sidebar: institution multi-select (first = responsible), due date chips, note, notify toggles, assign button → "Užduotis išsiųsta" state, "Gyventojai mato" preview.
- Data: `getProblem(id)`, `updateProblemStatus(id, { status: "ongoing" })` on assign; institution assignment is an api-gap.

**Checkpoint:** assigning flips the sidebar to the sent state; the problem shows yellow on the resident map.

## Phase 10 — Real map

- Replace the SVG backdrop with Leaflet + OpenStreetMap tiles (`react-leaflet`), keep the notched markers as `divIcon`s, clustering, user geolocation.
- Used on Map, Verify and the municipality hotspots.

**Checkpoint:** markers sit on real Vilnius streets; panning/zooming works on phone width.

## Phase 11 — API client tests

- Add Vitest + MSW (node) and reuse the Phase 0 handlers.
- `client.ts`: base URL + query building (skips `undefined`/`null`), `Authorization: Token …` header only when a token exists, JSON vs `FormData` bodies (no manual `Content-Type` for multipart), 204 → `undefined`, non-JSON bodies, `ApiError` status and `detail`, token storage fallback when `localStorage` throws.
- One test per endpoint function: correct method, path (with encoded id), query/body shape, typed response.
- `session.ts`: `createSession`/`login` store the token; `logout` clears it even when the request fails.
- Multipart: `createReport`/`createProblemValidation` send each media file under `media`, omit absent optional fields.
- Contract check: a script that walks `api/openapi.yaml` and fails if an operation has no matching client function.
- Live smoke test (optional, `VITE_API_MOCKS=false`): run the page flows against `manage.py runserver` once backend endpoints land.
- Add `npm test` to the checkpoint routine from here on.

**Checkpoint:** `npm test` green; coverage report shows every function in `src/api/` exercised.

---

## API gaps

Data the design needs that `api/openapi.yaml` doesn't provide. Mocked in the frontend until the backend adds them:

| Need | Screens | Suggested API |
|---|---|---|
| Priority score + breakdown | 4, 8, 10 | `priority_score`, `priority_factors` on `Problem` |
| AI analysis before submit | 2 | `POST /reports/analyze` (media → category, urgency, address, transcript) |
| Nearby duplicate candidates | 3 | `GET /problems/nearby?lat=&lng=&radius=` with match % |
| Urgency votes | 4, 5a, 10 | `urgency_votes` on `Problem`, vote in `ValidationCreate` |
| Status history | 4, 10 | `GET /problems/{id}/history` |
| Follow a problem | 4 | `POST /problems/{id}/follow` |
| Address / district on problem | most | `address`, `district` on `Problem` |
| Challenge progress, leaderboard, create, join by code | 6 | extend `ChallengeDetail`; `POST /challenges`; `POST /challenges/join-by-code` |
| User stats (reports, validations, level, impact) | 7 | fields on `User` |
| Landmark collection | 7, 7a | `GET /users/me/collection` |
| Partner prizes + redeem | 7 | `GET /rewards`, `POST /rewards/{id}/redeem` |
| City KPIs + district stats | 8, 9 | `GET /stats/city`, `GET /districts/{id}/stats` |
| Institutions + assignment | 10 | `GET /institutions`, `POST /problems/{id}/assignments` |

## Progress

- [x] Phase 0 — Foundation
- [x] Phase 1 — Splash + Map
  - Deviation: the "vis dar yra?" banner shows the truly nearest problem to the (fixed) user location, so copy differs from the board ("Šiukšlės už 140 m").
  - Deviation: no cluster-count marker yet (comes with clustering in Phase 10).
  - Search input is visual only.
- [ ] Phase 2 — Report flow
- [ ] Phase 3 — Problem detail
- [ ] Phase 4 — Verification
- [ ] Phase 5 — Challenges
- [ ] Phase 6 — Profile + Collection
- [ ] Phase 7 — Municipality dashboard
- [ ] Phase 8 — District dashboard
- [ ] Phase 9 — Problem card + assignment
- [ ] Phase 10 — Real map
- [ ] Phase 11 — API client tests
