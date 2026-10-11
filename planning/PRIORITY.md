# Priority and trust

**Status: approved 2026-10-11, built in checkpoint 8.** The numbers are a starting point and are meant to be tuned. Every weight lives in one backend module, and the API returns each problem's score broken down by factor, so changing a weight never makes the result harder to explain.

## Why this exists

The municipality needs to answer one question every week: **where do we send crews first?** Today the app guesses with a formula that runs in each browser, and ignores how reliable the reports are.

This proposal moves the answer to the backend and makes it:

- **Explainable.** Each problem carries its score *and* the reasons for it ("Pavojinga gyvybei: 35 of 35, Prie mokyklos: 15 of 15, …"), so a case worker can defend a decision and a resident can see why their pothole waits.
- **Hard to game.** Reports and answers count by how reliable their authors have been (trust), not by how many there are. Fifty fake confirmations from new accounts don't outrank one dangerous, well-confirmed problem.
- **One source of truth.** The resident map, the city dashboard and the API all show the same score. The dashboard's district filter narrows the ranking to one seniūnija, with the highest priority still on top.

It has two parts:

1. **Trust**: how reliable each resident has been, learned from outcomes.
2. **Priority**: a 0–100 score for each open problem.

## 1. Trust: how reliable a resident is

### What counts

Every report and every answer ("Problema yra", "Problemos nėra") ends up in one of three states:

| Outcome | When | Example |
|---|---|---|
| **Proved right** | It was paid under the points ladder (see `problems/lifecycle.py`) | Your "Problema yra" helped confirm a problem; the city later fixed the problem you reported |
| **Proved wrong** | The city canceled the problem as not real, or moderators confirmed the report harmful | You reported something that wasn't there; your report was abusive |
| **Not known yet** | Neither has happened | A fresh report nobody has checked yet; a "Problemos nėra" whose fix was reopened (see below) |

**A reopened fix doesn't count against anyone.** If you say a problem is gone and a neighbour finds it still there, your claim simply isn't paid. Problems do come back (a patched pothole cracks again, a cleaned spot gets littered), so a reopening is not proof that you were wrong.

### The formula

```
trust = 100 × (right + 1) / (right + wrong + 2)
```

This is a success rate that starts in the middle and moves as evidence comes in. (Statisticians call it the Laplace rule of succession; it keeps one early mistake from branding someone unreliable forever.)

| History | Trust |
|---|---|
| New resident, nothing known yet | **50** |
| 3 right, 0 wrong | 80 |
| 10 right, 1 wrong | 85 |
| 1 right, 3 wrong | 33 |
| 0 right, 5 wrong | 14 |

Trust is recomputed whenever one of the resident's claims is proved right or wrong. It is shown on the profile as "Patikimumas" (reliability). That's the real value, replacing today's browser estimate.

### What trust changes

**Weight.** Each report or answer counts as

```
weight = 0.5 + trust / 100        (between 0.5 and 1.5; a new resident counts as 1.0)
```

**Confirmation.** A problem is confirmed when *at least two different people* say it's there *and* their combined weight reaches **2.0**:

- Two new residents (1.0 + 1.0): confirmed, same as today.
- Two residents with a poor record (0.7 + 0.7): not yet, so a third is needed.
- One very reliable resident alone (1.5): never enough. It always takes two people.

**Evidence in the priority score**, below.

Points are unaffected. The ladder already pays only for claims that proved right. Trust is the long-term memory of the same signal.

## 2. Priority: a score from 0 to 100 for each open problem

Only **open** problems get a score: waiting for confirmation, confirmed, handed over, or being fixed. Fixed and canceled problems have none.

The score is the sum of five factors. Each has a ceiling, so no single factor can drown the others:

| Factor | Max | What it measures | How |
|---|---|---|---|
| **Danger** | 35 | How harmful it is, according to residents' urgency votes | Average of the votes, with "Pavojinga gyvybei" = 3, "Skubu" = 2, "Gali palaukti" = 1, scaled to 35. All votes dangerous → 35; all urgent → 23; all "can wait" → 12 |
| **Evidence** | 25 | How sure we are that it's real | Trust-weighted support *W* (reports + "Problema yra" answers, each with its weight) → `25 × (1 − e^(−W/3))`. 1 newcomer → 7; 2 → 12; 4 → 18; 8 → 23. More confirmations add less and less, so a crowd can't outweigh danger |
| **Vulnerable place** | 15 | Near a school, kindergarten, hospital or playground | 15 if flagged, otherwise 0 |
| **Waiting** | 15 | How long people have been living with it | `15 × log(1 + days) / log(31)`, capped at 15. 1 day → 3; 1 week → 9; a month or more → 15 |
| **Signals** | 10 | Warning signs | +6 if residents reopened it after a fix that didn't hold; +4 if 2 or more new confirmations arrived in the last 72 hours (it's getting worse or more visible) |

**Bands**, used by the dashboard for colour and wording:

| Score | Band |
|---|---|
| 70–100 | **Kritinis** (critical) |
| 50–69 | **Aukštas** (high) |
| 30–49 | **Vidutinis** (medium) |
| 0–29 | **Žemas** (low) |

### Worked examples

| Problem | Danger | Evidence | Place | Waiting | Signals | **Score** |
|---|---|---|---|---|---|---|
| Unlit crossing by a school: reported and confirmed by 3 residents (all trust 50), all voting dangerous, 5 days old | 35 | 16 | 15 | 8 | 0 | **74 Kritinis** |
| Pothole: reported and confirmed by 2 reliable residents (trust 80), urgent, 10 days old, reopened once | 23 | 15 | 0 | 10 | 6 | **54 Aukštas** |
| Overflowing bin, can wait, just reported by a newcomer | 12 | 7 | 0 | 0 | 0 | **19 Žemas** |
| Same bin after 20 fake confirmations from distrusted accounts (trust 14, weight 0.64 each) | 12 | 25 | 0 | 0 | 4 | **40 Vidutinis**, still far below the school crossing |

Factors are computed to one decimal and the total is rounded once, so the rounded factors in a row can differ from the score by 1.

The last row shows why evidence has a ceiling and diminishing returns: piling on low-trust confirmations moves a minor problem up a band, but it can't jump the queue over real danger.

### What the API returns

Each problem in `GET /api/problems` and `GET /api/problems/{id}`:

```json
"priority": {
  "score": 74,
  "band": "critical",
  "factors": [
    { "key": "danger",    "label": "Pavojingumas",       "points": 35, "max": 35, "detail": "3 iš 3 balsų: pavojinga gyvybei" },
    { "key": "evidence",  "label": "Patvirtinimai",      "points": 16, "max": 25, "detail": "3 gyventojai, svoris 3,0" },
    { "key": "place",     "label": "Jautri vieta",       "points": 15, "max": 15, "detail": "Prie mokyklos ar darželio" },
    { "key": "waiting",   "label": "Laukia",             "points": 8,  "max": 15, "detail": "5 d." },
    { "key": "signals",   "label": "Įspėjamieji ženklai", "points": 0,  "max": 10, "detail": "–" }
  ]
}
```

`priority` is `null` for fixed and canceled problems. The labels are in Lithuanian so the dashboard can show them as they are.

## How it gets built

| Piece | Where |
|---|---|
| Trust outcomes: a `refuted` flag on reports and answers, set when the city cancels a problem or moderators confirm a report harmful | `reports`, `validations` models + `problems/lifecycle.py`, `moderation` |
| Trust recomputation, weights, the 2-people-and-2.0 confirmation rule | `problems/trust.py` (new) |
| Priority score and its factors | `problems/priority.py` (new); every weight is a named constant at the top |
| Moderation confirming a report harmful refutes it | `moderation/services.py` (replaces the placeholder) |
| Existing users' trust from their history; default trust 100 → 50 | data migration |
| App and dashboard read the score and its breakdown from the API (same layout as before); profile shows the real trust | frontend |

Every factor gets its own tests, plus the four worked examples above as end-to-end tests, so the documented numbers and the code can't drift apart.

## Tuning later

All weights are constants in `problems/priority.py` and `problems/trust.py`, each with a comment saying what it does. Good next refinements once there is real data:

- Learn the danger weights from what the city actually fixed first.
- Weight urgency votes by trust too, not only confirmations.
- A district "need" figure: the open, unassigned priority added up per seniūnija (ideally per resident, once population figures are added), for weekly planning across the city.
- Let categories carry a base severity (for example, a gas smell beats graffiti even before anyone votes).
