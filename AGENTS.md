# AGENTS.md

## Project overview

A civic issue-reporting app that improves on **TvarkauMiesta** (Lithuanian city-problem reporting service). Core thesis:

> **Gamification + competition + discounts = engagement**

Citizens act as **"city agents"** (*miesto agentai*): reporting, verifying and tracking city problems. Gamification doubles as a quality-control mechanism for how problems get resolved, and gives people a visible motivation: they see that reported problems actually get fixed.

## Code style and checks (mandatory)

Strictly follow the formatting and checking workflow defined in `README.md`. Before considering any backend change complete, run all of the following and make sure they pass with no errors:

```bash
uv --directory ./src/backend run ruff format
uv --directory ./src/backend run ruff check
uv --directory ./src/backend run basedpyright
```

- Do not skip, disable or work around these tools (no blanket `# noqa`, `# type: ignore` or config changes to silence errors).
- Install dev dependencies first with `uv sync --group dev`.
- If models change, create and apply migrations as described in `README.md`:
  ```bash
  uv --directory ./src/backend run python manage.py makemigrations
  uv --directory ./src/backend run python manage.py migrate
  ```
- Use `uv` for all Python commands; do not use bare `pip` or `python`.

## Core problems to solve

These are the key gaps to address first:

1. **Validation**: verify that a reported problem is real and not a duplicate.
2. **Classification**: categorize reports and cluster reports of the same problem together.

## Key features

### 1. Prioritization
- Rank problems by importance, number of reports and trust of reporters.
- Prioritize by district (*rajonas*).
- Show trends over time.

### 2. Validation
- Problem verification by other users.
- **Trust index** per user: reliable reporters carry more weight.
- **Clustering** of reports describing the same problem.

### 3. Competition between districts
- **Points system** for users.
- **User and district rankings** (leaderboards).
- Competition between district communities (e.g. who reports and resolves more problems).
- Rewards via **discounts** from partner businesses.

### 4. Discovery routes
- Suggested walking routes based on problems other users have marked.
- Aimed at people who like to walk without a set destination; they can verify problems along the way.

## UX requirements

- **Launch screen setting**: user chooses what opens first: **Feed / Map / Photo**.
- **Large primary action button** at the bottom of the screen (report a problem).
- **Prompt for a comment after taking a photo.** Feedback (via Vilnius mayor Benkunskas encouraging usage) showed that reports often consist of a photo with no comment.

## Gaps in TvarkauMiesta (what we do differently)

| Missing in TvarkauMiesta | Our approach |
|---|---|
| No points system | Points for reporting, verifying, resolving |
| No trust index | Per-user trust score feeding validation |
| No problem prioritization | Priority scoring |
| No prioritization by district | District-level priority views |
| No trends | Trend analytics |
| No district rankings | District leaderboards |
| No competition between district communities | Inter-district competition |

## Municipality view

What the municipality gets / sees:

- Prioritized, validated, deduplicated problem list.
- Breakdown by district and trends over time.
- *(To be defined further.)*

## Monetization (open question)

- Business sponsors (e.g. funding the discount rewards).
- Possibly charging users. Still undecided.

## Testing TvarkauMiesta (competitor research)

Test cases to run against the existing service:

- [ ] Report a problem.
- [ ] Report the same problem from different accounts (check for duplicate detection/clustering).
