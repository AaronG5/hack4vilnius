# Data analysis: what every screen shows and how it gets populated

Goal: a polished MVP with nothing a judge or a tester can pick on. That means every number, name and list on screen has to come from somewhere real, and every action has to have a visible effect.

This document goes screen by screen. For each piece of data it says where the value comes from today and the method that should populate it. The fixes are collected at the end in one priority order.

Snapshot: 2026-10-10, `main` at `77e7030` plus the institution workload removal.

## Where values come from today

| Tag | Meaning | OK for the MVP? |
|---|---|---|
| **API** | Read from Django as stored | Yes, provided the backend fills it in |
| **Derived** | Calculated in the browser from API data | Yes for display logic. Scores and statistics should move to the backend so the app and the dashboard agree |
| **Local** | Stored in this browser only (`localStorage`) | No for shared state (assignments, joined challenges). Other users and the dashboard can't see it |
| **Static** | Hard-coded but true (labels, rules, landmark list) | Yes |
| **Fake** | Hard-coded numbers or names shown as if real | No. Remove them or populate them |
| **Stub** | The backend endpoint exists but always returns a default | No, if the screen implies it works |

## The ten issues most likely to be noticed

1. **Points are never added.** The app says "+20 tšk." and "+10 tšk.", but no backend code increments `User.points`. `calculate_points` returns 10 and stores it on the validation only. As a result the profile shows 0 points, the level stays "Naujokas" and every prize stays locked.
2. **Problems never change status by themselves.** `evaluate_problem_validations` does nothing. Problems stay "nepatvirtinta" no matter how many people confirm them, and "Sutvarkyta" answers never close one. Only a staff `PUT /status` moves them.
3. **The municipality can't act.** There is no staff login, so assigning returns 403 for everyone except a user promoted by hand in the shell. The assignment itself (institutions, deadline, note) is kept in the browser only.
4. **The report title and address are dropped.** The form sends `title`, `address`, `urgency` and `near_sensitive`, but the backend ignores them. The title falls back to the first sentence of the description and the address to the district name. The "Prie mokyklos" flag and the reporter's urgency are lost.
5. **The backend doesn't detect duplicates.** `find_duplicate_problem` always returns nothing. The app's own check (same category within 270 m) only runs when the reporter is shown the candidate list, so two people reporting the same pothole get two problems.
6. **Notifications are in English and only one kind exists.** The text is "A problem you're involved with is now Ongoing." There are no "still there?" requests and no points notifications, although the UI has styles for both.
7. **Urgency voting goes nowhere.** `POST /problems/{id}/urgency-votes` doesn't exist. The buttons show "Skubumo balsavimas dar neveikia", and the tally only ever shows the problem's own urgency as one vote.
8. **The challenge screens are mostly made up.** School, company, bike-path and yard leaderboards use invented names and scores ("Nord Security 436", "Rūta V. 14 km"), invented percentages and deadlines ("Liko 12 dienų"), and an invented city counter (`640 + yours` of 1,000).
9. **Anonymous users have no name.** `name` is empty, so the avatar shows no initials and the profile title reads "Jūsų profilis". Problem history shows "Sujungtas dublikatas · " with nothing after it.
10. **The prizes are hard-coded.** "JUDU kelionių kreditas 500" and "Go Vilnius bilietas 1500" are not from any partner data, and "Iškeisti" only shows a toast.

## Screen by screen

### Map (`/map`)

| Data | Today | How to populate |
|---|---|---|
| Pins, positions, categories | API `GET /problems` + `GET /problems/{id}` for each | Works. Add list summaries (title, address, photo, counts) to `GET /problems` so the app makes one request instead of N+1 |
| Pin colour / status (`new`, `ok`, `urgent`, `work`, `fixed`) | Derived from `status`, plus the priority score for "skubi" | Fine once item 2 is fixed. Today almost everything is "new" |
| Priority score | Derived: the demo formula in `problemModel.ts › priorityScore` | **BE:** return `priority_score` on the problem so the map, dashboard and sorting all use one formula. It should include trust (AGENTS.md › Prioritization) |
| District of a problem | Derived: point-in-polygon against `GET /districts` | Works. Optionally store `district` on `Problem` when it's created so filters can run on the server |
| Title / address | Derived fallback (see item 4) | **BE:** store `title`, `address` and `near_sensitive` from the report form. **BE:** reverse geocoding (Photon `/reverse`) when no address is typed |
| Filter counts, "Vis dar yra?" prompt | Derived | Works |

### Report sheet (camera → form → map → duplicates)

| Data | Today | How to populate |
|---|---|---|
| Category suggestion ("DI") | **Fake/Stub mix.** The frontend `gaps.ts › analyzeReport` matches keywords after a 1.2 s artificial delay and shows a "confidence 82 %". The backend separately asks Claude for categories **after** submission (`reports/services.py › suggest_category`) | **BE:** `POST /reports/analyze` (text + optional photo) → category, urgency, title, confidence, using the existing Claude call (add the image for photo recognition). **FE:** call it instead of `analyzeReport`; drop the made-up confidence number |
| Address search | API `GET /geocode` (Photon) | Works |
| GPS position and accuracy | Browser geolocation | Works (needs HTTPS on phones) |
| Street name for the GPS pin | Missing ("TODO reverse geocoding") | **BE:** `GET /geocode/reverse?lat&lng` through the same Photon proxy |
| "Prie mokyklos" | Derived: keyword regex in the text | **BE:** check the distance to schools and kindergartens (OSM `amenity=school\|kindergarten`, loaded once into a table) |
| Duplicate candidates | Derived: same category within 270 m among the problems already loaded | **BE:** `GET /problems/nearby?lat&lng&category` plus `find_duplicate_problem` doing the same check at submit time |
| "+20 tšk." toast | **Fake** (see item 1) | **BE:** award points on report and return `points_awarded` in the report response, as validations already do |

### Problem sheet (`/problems/:id`)

| Data | Today | How to populate |
|---|---|---|
| Photos and photo history | API media on reports and validations | Works (links fixed to same-origin) |
| Confirmations, "sutvarkyta" votes | Derived from validations | Works |
| Urgency tally and my vote | Derived fallback: one vote for the problem's own urgency | **BE:** `UrgencyVote` model + `POST /problems/{id}/urgency-votes`; return `urgency_votes` and `my_urgency_vote` on the problem (the mock already has this shape) |
| "Nežinau" | Not sent anywhere | Fine as is. Optionally count it as "seen" for routes later |
| Points in toasts | API `points_awarded` (always 10) | **BE:** apply the points to the user (item 1). Optionally give more points for a photo |
| Status text | Derived from `status` | Fine once item 2 is fixed |

### Notifications (`/notifications`)

| Data | Today | How to populate |
|---|---|---|
| List, read state | API | Works |
| Message text | API, **in English** | **BE:** Lithuanian text for each event, e.g. "Jūsų pranešta problema „{title}“ dabar sprendžiama." |
| `validation_requested` | Never created | **BE:** when a problem is assigned, completed, or older than N days, notify residents who were nearby or involved: "Ar vis dar yra?" |
| `points_awarded` | Never created | **BE:** create one when points are applied (badge earned, challenge goal reached) |

### Challenges (`/challenges`, `/challenges/:id`, `/challenges/new`)

| Data | Today | How to populate |
|---|---|---|
| Challenge list, names, descriptions, dates, reward points | API `GET /challenges` (6 seeded) | Works |
| Tag, colour, icon | Static, matched by name in `challengeMeta.ts` | **BE:** add `kind` (`seasonal`, `districts`, `schools`, `companies`, `theme`, `yards`) and `icon` to `Challenge`, so a new challenge doesn't need a code change |
| "Liko 12 dienų", "Iki gruodžio 20 d." | **Fake** (hard-coded) | **FE:** compute from `end_date`. The API already has it |
| Rules, prize text | Static copy in `challengeMeta.ts` | **BE:** `rules` (list) and `prize` (text) on `Challenge`, or keep them static but make them match the seeded challenges |
| Seasonal counter "640 iš 1 000" | **Fake** | **BE:** `progress` and `target` on the challenge (count of matching validations since `start_date`); `milestones` is already in the API but returns an empty list |
| District race table | Derived from live problems | Works. Ideally **BE:** `GET /leaderboards/districts` |
| School / company / bike / yard leaderboards | **Fake** names and scores | **BE:** `Team` (name, kind, join code) + `TeamMember`, and `GET /challenges/{id}/leaderboard`. Until then, **FE:** show "Lentelė atsiras, kai prisijungs pirmos komandos" instead of invented rows |
| Progress bars (62 %, 58 %, 32 %, 18 %) | **Fake** | Same as the counter: from `progress`/`target` |
| "Dalyvaujate" (joined) | **Local** plus `POST /join` | **BE:** return `joined` for the current user in `GET /challenges`, and add `DELETE /challenges/{id}/join`. `participant_count` already exists in `GET /challenges/{id}` but isn't shown |
| Private challenges, codes `DRG-XXXX` | **Local** | **BE:** `POST /challenges` (private, with code) and `POST /challenges/join-by-code` |
| Weekly challenge "x/5" | Derived from the user's activity | Works. The "+50 tšk." reward isn't paid: needs the backend points logic |

### Profile (`/profile`)

| Data | Today | How to populate |
|---|---|---|
| Name, avatar initials | API, but empty for anonymous users | **FE:** a "Kaip jus vadinti?" field (`PATCH /users/me` already exists). **BE:** generate a default name such as "Agentas #1234" |
| Points, level | API `points` (always 0) | Item 1. The level thresholds are static, which is fine |
| District | API `district` (never set), else the district of the last action | **BE:** set `User.district` on the first report, or **FE:** let the user pick it in the profile (`PATCH /users/me`) |
| Reports, checks counts | Derived | Works |
| "Patikimumas" % | Derived: how often my answers matched the outcome | **BE:** return the real `trust_score`, which the API already has (but it never changes: `compute_trust_adjustment` is a stub). The trust index is a core AGENTS.md feature |
| Badges | **Derived in FE**; `GET /users/me/badges` is never awarded to | **BE:** award a `UserBadge` when the criteria are met (3 badges are seeded with criteria). **FE:** read `getCurrentUserBadges` + `listBadges` (the client functions exist, unused) |
| Vilnius landmark collection | Static landmarks + derived from activity | Works, truthful |
| Partner prizes | **Fake** | **BE:** `Reward` (partner, name, cost) + `GET /rewards`, `POST /rewards/{id}/redeem` (deducts points, returns a code). Until then, **FE:** label the section "Netrukus" with no prices, or hide it |
| "Mano pranešimai" | Derived | Works |

### Municipality: priorities (`/city`)

| Data | Today | How to populate |
|---|---|---|
| Ranking, filters, map hot spots | Derived from all problems | Works. Move the score to the backend (see Map) |
| "Patvirtino bendruomenė ≥ 3 patikimi" | Derived: ≥ 3 confirmations, trust not considered | **BE:** trust-weighted confirmations, or reword to "≥ 3 patvirtinimai" |
| "DI sujungti dublikatai" | Derived: reports − 1 per problem | Correct, but it stays 0 until the backend groups duplicates (item 5). Reword to "sujungti dublikatai" unless the AI really does it |
| Trend ▲ | Derived heuristic | **BE:** `GET /stats/city` or a `trend` field per problem |
| "Atidaryta iš naujo" | Derived from `updated_at` vs. validations | **BE:** a `completed_at` field or status history makes this exact |
| Access | Anonymous session | **BE:** staff login (`POST /api/auth/login` exists) + **FE:** a login form at `/city/login` for staff and city administrators |

### Municipality: problem card (`/city/problems/:id`)

| Data | Today | How to populate |
|---|---|---|
| Photos, description, votes, history | API + derived | Works |
| "Atpažinta: X · patikimumas 50 %" | API `ai_category_suggestion` (real Claude) + `legitimacy_score` (**Stub**, always 50) | **BE:** real legitimacy (trust of reporters, photo present, confirmations), or hide the percentage until then |
| Institution list and scope text | **Static** (6 institutions). The DB seeds only 4: Vilniaus vandenys and Seniūnija are missing | **BE:** `GET /institutions` with `scope`; seed all 6. **FE:** read from the API |
| "DI siūlo" institution | API `category.institution`, else the static mapping | Works once categories point to institutions (4 categories currently have none) |
| Assignment: institutions, deadline, note, toggles | **Local** + `PUT /status` | **BE:** `Assignment` (problem, institutions with lead/co-lead, due date, note, notify, ask photo) + `POST /problems/{id}/assignments`; set `Problem.institution` |
| Progress steps "priėmė / vyksta" | Derived from status | Needs an institution side that moves `pending → ongoing → completed`. For the MVP, the staff user can do it by hand: add "Pažymėti: priimta / sutvarkyta" buttons in the sent panel |
| "Rašyti vykdytojui" | `mailto:` the static contact | Works; the address comes from the API once institutions are served |
| "N sekėjai gaus pranešimą" | Derived: reporters + validators | Correct; the backend notifies the same set |
| "GPS proximity and reporter levels" | Not shown | Optional |

### Municipality: district (`/city/districts/:id`)

| Data | Today | How to populate |
|---|---|---|
| 8-week chart, KPIs, top categories, longest waiting | Derived from all problems | Correct for what exists. Empty until there is history |
| Average resolve time | Derived from `updated_at` (wrong if the problem is edited after completion) | **BE:** `completed_at` |
| "Atnaujinama kas savaitę" | **Static label, untrue**: it updates live | **FE:** change it to "Atnaujinama realiu laiku" or remove it |

## Calculations to move to the backend

These run in the browser today. They should live in one place so the resident app, the dashboard and any later export agree:

- Priority score: `problemModel.ts › priorityScore`. Add the trust weighting the AGENTS.md spec asks for.
- Status transitions from validations: confirm at N trust-weighted "vis dar yra", complete at N "sutvarkyta" after assignment. This is item 2.
- Trend, reopened, average resolve time: `cityStats.ts`.
- Trust score: profile "Patikimumas". Update `User.trust_score` when a problem's outcome is known, then weight validations with it.
- District of a problem and user district rankings.

## Missing features that AGENTS.md promises

| Feature | State | Minimum to show it |
|---|---|---|
| Launch screen setting (Feed / Map / Photo) | Missing | **FE:** a setting in the profile, stored per browser (a per-viewer preference, so `localStorage` is right). Open `/map`, the list, or the report sheet on start |
| User leaderboard | Missing (only districts) | **BE:** `GET /leaderboards/users?district=` from `points`. **FE:** a tab in Challenges |
| Discovery routes | Missing | **FE:** "Pasivaikščiojimas" builds a loop through the 5–8 nearest unconfirmed problems (client-side ordering is enough for the MVP) and shows it on the map |
| Trust index | Field exists, never changes | See "Calculations to move" |
| Moderation | API exists (`/moderation/flags`), no UI; `detect_abuse` is a stub | **FE:** a small staff list at `/city/moderation`. **BE:** let the existing Claude call return an abuse flag too |
| Comment prompt after a photo | Done (form asks for a description) | – |

## Seed data for the demo

`seed_demo` gives categories, 21 districts, 3 badges and 6 challenges; `--with-examples` adds 9 example problems. For a live demo:

- Seed the two missing institutions (Vilniaus vandenys, Seniūnija) and link every category to one.
- Seed a staff user (`city_administrator`) with a known password for the dashboard login.
- Optionally seed real teams for the school and company challenges, but only with organisations that agreed to take part. Otherwise ship those two challenges as "Netrukus" (coming soon).
- Charts need history to look alive. Earlier we decided not to fake it (see "Maybe later" in `FRONTEND_PLAN.md`). The honest alternative is a few days of real use by the team before the demo.

## Smaller polish items

- All user-facing text should be Lithuanian (backend notifications, Django error messages that reach toasts).
- Empty states: challenge leaderboards with no rows, profile with no name, dashboard with no problems in a period. All should say why they are empty.
- Show `participant_count` on challenge cards ("128 dalyviai"); the API already has it.
- Remove "DI" wording wherever no AI was involved: keyword matching on the report form, and "DI sujungė" when the merge was done by the reporter.
- The report form's "confidence 82 % / 35 %" is a made-up number. Hide it until the analyse endpoint returns a real one.

## Points and the fix window (checkpoint 6, 2026-10-11)

Decided with the product owner and implemented in `src/backend/problems/lifecycle.py`:

- Points reward claims that proved true, never the act of claiming. A report earns 20 once its problem is confirmed; the answers that confirm it (the first 2) earn 10 each at that moment; later answers earn 10 only when the city takes the problem on.
- "Problemos nėra", or the city marking it fixed, keeps the problem on the map in green for 1 hour. The first 2 neighbours to confirm earn 10, and so does whoever claimed the fix. "Vis dar yra" in that hour reopens it, and the claim earns nothing. After the hour it leaves the map either way.
- Everyone paid gets a "Gavote N tšk.!" notification.

## Suggested order

| # | Work | Who | Unblocks |
|---|---|---|---|
| 1 | ✅ Apply points to `User.points` on report and validation, with a backfill for past actions – checkpoint 3, 2026-10-11 (`points_awarded` notification moves to item 4) | BE | Profile, levels, prizes, every toast |
| 2 | ✅ `evaluate_problem_validations`: unconfirmed → confirmed / canceled by agreeing answers – done by the backend team (4f61545) | BE | Map colours, dashboard, "fixed" flow |
| 3 | ✅ Store `title`, `address`, `near_sensitive`, reporter urgency on report create – checkpoint 3, 2026-10-11 | BE | Every list and card |
| 4 | ✅ Lithuanian notification texts, sent also when residents' answers confirm or cancel – checkpoint 4, 2026-10-11. `validation_requested` deferred: no nearby residents to ask yet | BE | Notifications screen |
| 5 | ✅ (no login, by decision) `CITY_TOOLS_FOR_EVERYONE` in development + "accepted / fixed" buttons on the city card – checkpoint 4, 2026-10-11 | FE + BE | Whole municipality flow end to end |
| 6 | ✅ Remove or replace the fake challenge numbers (deadlines from `end_date`, empty leaderboards, no fake counter) – checkpoint 1, 2026-10-10 | FE | Challenges |
| 7 | ✅ Hide or relabel prizes and the DI confidence; anonymous default name + name field – checkpoint 2, 2026-10-11 | FE | Profile, report form |
| 8 | ✅ `GET /problems/nearby` + backend duplicate check (same category within 25 m joins automatically) – checkpoint 5, 2026-10-11 | BE | Validation and clustering (core problem #1) |
| 9 | ✅ Urgency votes, carried by answers instead of a separate endpoint – done by the backend team (4f61545) | BE | Problem sheet, priority |
| 10 | `GET /institutions` + `Assignment` model | BE + FE | Municipality card |
| 11 | ✅ Badges awarded by the backend by rule (first report, 5 answers that proved right, joining the seasonal challenge); profile reads `/users/me/badges` – checkpoint 7, 2026-10-11 | BE + FE | Profile |
| 12 | Launch screen setting, ✅ user leaderboard (`GET /api/leaderboard`, checkpoint 7), discovery route | FE (+ small BE) | AGENTS.md feature list |
| 13 | `priority_score`, trust score, `completed_at` on the backend | BE | Consistency, trust index |

Items 1–7 are the "nothing to pick on" set: each is small, and together they remove every fake number and every action that silently does nothing. Items 8–13 make the core thesis (validation, clustering, trust) real.
