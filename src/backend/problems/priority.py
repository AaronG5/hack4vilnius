"""
Priority: a 0-100 score for each open problem, with the reasons for it.

See planning/PRIORITY.md, "Priority". The score answers "where do we send
crews first?". It is the sum of five factors, each with a ceiling so that no
single one drowns the others:

    danger (35) + evidence (25) + vulnerable place (15) + waiting (15)
    + signals (10)

Every weight is a named constant below. `priority_of` returns each factor
with its points, its ceiling and a Lithuanian explanation, so the dashboard
can show exactly why a problem ranks where it does. Factors are kept to one
decimal and the total is rounded once.
"""

import datetime as dt
import math
from typing import TypedDict

import validations.services as validation_services
from django.utils import timezone
from problems import trust
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

# -- Danger: the average of residents' urgency votes, scaled to DANGER_MAX. --
DANGER_MAX = 35.0
_SEVERITY: dict[str, int] = {
    ProblemUrgency.DANGEROUS_TO_LIFE: 3,
    ProblemUrgency.URGENT: 2,
    ProblemUrgency.CAN_WAIT: 1,
}

# -- Evidence: trust-weighted support W, as EVIDENCE_MAX x (1 - e^(-W / k)).
# Each extra confirmation adds less than the one before, so a crowd of weak
# confirmations can't outweigh danger. With k = 3: one newcomer gives 7,
# two 12, four 18, eight 23.
EVIDENCE_MAX = 25.0
EVIDENCE_SCALE = 3.0

# -- Vulnerable place: near a school, kindergarten, hospital or playground. --
PLACE_MAX = 15.0

# -- Waiting: grows with the logarithm of days since it was reported, and
# reaches WAITING_MAX at WAITING_FULL_DAYS: 1 day 3, a week 9, a month 15.
WAITING_MAX = 15.0
WAITING_FULL_DAYS = 30

# -- Signals: warning signs, up to SIGNALS_MAX.
SIGNALS_MAX = 10.0
# Residents reopened it after a fix that didn't hold.
REOPENED_POINTS = 6.0
# At least MOMENTUM_ANSWERS new "it's there" answers in MOMENTUM_WINDOW.
MOMENTUM_POINTS = 4.0
MOMENTUM_ANSWERS = 2
MOMENTUM_WINDOW = dt.timedelta(hours=72)

# Bands, highest first: (lowest score in band, key).
BANDS: tuple[tuple[int, str], ...] = (
    (70, "critical"),
    (50, "high"),
    (30, "medium"),
    (0, "low"),
)

# Only these get a score; fixed and canceled problems need no crew.
OPEN_STATUSES = frozenset(
    {
        ProblemStatus.UNCONFIRMED,
        ProblemStatus.CONFIRMED,
        ProblemStatus.PENDING,
        ProblemStatus.ONGOING,
    },
)


class Factor(TypedDict):
    """One reason in a problem's score; `detail` is empty if there's nothing to add."""

    key: str
    label: str
    points: float
    max: float
    detail: str


class Priority(TypedDict):
    """A problem's score, its band and the factors behind it."""

    score: int
    band: str
    factors: list[Factor]


def _plural(n: int, forms: tuple[str, str, str]) -> str:
    """Pick the Lithuanian form for `n`: (1, 21…), (2-9, 22-29…), (0, 10-20…)."""
    last = n % 10
    teen = (n // 10) % 10 == 1
    if teen or last == 0:
        return forms[2]
    return forms[0] if last == 1 else forms[1]


def _decimal(value: float) -> str:
    """'3,0': one decimal with a Lithuanian decimal comma."""
    return f"{value:.1f}".replace(".", ",")


def band_of(score: int) -> str:
    """Return the band key for `score`."""
    return next(key for lowest, key in BANDS if score >= lowest)


def danger(votes: dict[str, int]) -> Factor:
    """Score the average severity of residents' urgency votes."""
    total = sum(votes.values())
    severity = sum(_SEVERITY[urgency] * count for urgency, count in votes.items())
    points = DANGER_MAX * severity / (3 * total) if total else 0.0
    parts = [
        f"{votes[urgency]} {label}"
        for urgency, label in (
            (ProblemUrgency.DANGEROUS_TO_LIFE, "pavojinga gyvybei"),
            (ProblemUrgency.URGENT, "skubu"),
            (ProblemUrgency.CAN_WAIT, "gali palaukti"),
        )
        if votes.get(urgency)
    ]
    return {
        "key": "danger",
        "label": "Pavojingumas",
        "points": round(points, 1),
        "max": DANGER_MAX,
        "detail": ", ".join(parts) if parts else "Balsų nėra",
    }


def evidence(supporters: list[User]) -> Factor:
    """How sure we are it's real: trust-weighted support, with diminishing returns."""
    weight = sum(trust.weight(user) for user in supporters)
    points = EVIDENCE_MAX * (1 - math.exp(-weight / EVIDENCE_SCALE))
    people = len(supporters)
    forms = ("gyventojas", "gyventojai", "gyventojų")
    return {
        "key": "evidence",
        "label": "Patvirtinimai",
        "points": round(points, 1),
        "max": EVIDENCE_MAX,
        "detail": f"{people} {_plural(people, forms)}, svoris {_decimal(weight)}",
    }


def place(*, near_sensitive: bool) -> Factor:
    """Near a school, kindergarten, hospital or playground."""
    return {
        "key": "place",
        "label": "Jautri vieta",
        "points": PLACE_MAX if near_sensitive else 0.0,
        "max": PLACE_MAX,
        "detail": (
            "Prie mokyklos, darželio, ligoninės ar žaidimų aikštelės"
            if near_sensitive
            else ""
        ),
    }


def waiting(days: float) -> Factor:
    """How long people have lived with it, on a logarithmic scale."""
    scaled = math.log(1 + max(0.0, days)) / math.log(1 + WAITING_FULL_DAYS)
    whole = math.floor(max(0.0, days))
    return {
        "key": "waiting",
        "label": "Laukia",
        "points": round(min(WAITING_MAX, WAITING_MAX * scaled), 1),
        "max": WAITING_MAX,
        "detail": f"{whole} d." if whole else "Mažiau nei parą",
    }


def signals(*, reopened: bool, recent_answers: int) -> Factor:
    """Warning signs: a fix that didn't hold, or a burst of new confirmations."""
    points = 0.0
    parts: list[str] = []
    if reopened:
        points += REOPENED_POINTS
        parts.append("atidaryta iš naujo po sutvarkymo")
    if recent_answers >= MOMENTUM_ANSWERS:
        points += MOMENTUM_POINTS
        forms = ("naujas patvirtinimas", "nauji patvirtinimai", "naujų patvirtinimų")
        parts.append(f"{recent_answers} {_plural(recent_answers, forms)} per 72 val.")
    return {
        "key": "signals",
        "label": "Įspėjamieji ženklai",
        "points": min(SIGNALS_MAX, points),
        "max": SIGNALS_MAX,
        "detail": "; ".join(parts).capitalize(),
    }


def priority_of(problem: Problem, now: dt.datetime | None = None) -> Priority | None:
    """
    Score `problem` from 0 to 100 with its reasons; `None` if it isn't open.

    Evidence counts every report and "it's there" answer not proved wrong,
    one per person, each with its author's trust weight.
    """
    if problem.status not in OPEN_STATUSES:
        return None
    now = now or timezone.now()

    supporters: dict[str, User] = {}
    for report in Report.objects.filter(problem=problem, refuted=False):
        supporters[report.user.email] = report.user
    answers = Validation.objects.filter(problem=problem, is_valid=True, refuted=False)
    for answer in answers.select_related("user"):
        supporters[answer.user.email] = answer.user
    recent = answers.filter(created_at__gte=now - MOMENTUM_WINDOW).count()

    factors = [
        danger(validation_services.urgency_votes(problem)),
        evidence(list(supporters.values())),
        place(near_sensitive=problem.near_sensitive),
        waiting((now - problem.created_at).total_seconds() / 86_400),
        signals(reopened=problem.reopened_at is not None, recent_answers=recent),
    ]
    score = round(sum(factor["points"] for factor in factors))
    return {"score": score, "band": band_of(score), "factors": factors}
