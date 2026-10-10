"""
Notification-sending logic.

Deciding *who* gets notified and the exact message wording is simple
orchestration (not the kind of AI/trust-scoring logic this project defers),
so it's implemented directly rather than stubbed.
"""

from typing import TYPE_CHECKING

from notifications.constants import (
    EVENT_BADGE_AWARDED,
    EVENT_POINTS_AWARDED,
    EVENT_STATUS_CHANGED,
)
from notifications.models import Notification
from reports.models import Report
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

if TYPE_CHECKING:
    from collections.abc import Iterable

    from badges.models import Badge
    from problems.models import Problem
    from users.models import User


# What residents read when a problem they reported or answered moves on. The
# app shows the first sentence (up to "!" or "?") as the headline and the rest
# as the body, so each headline ends with one and the body uses neither.
_STATUS_MESSAGES: dict[str, tuple[str, str]] = {
    ProblemStatus.UNCONFIRMED: (
        "Problema vėl laukia patvirtinimo!",
        "„{title}“ grąžinta kaimynams patikrinti.",
    ),
    ProblemStatus.CONFIRMED: (
        "Kaimynai patvirtino problemą!",
        "„{title}“ dabar matoma savivaldybės prioritetų sąraše.",
    ),
    ProblemStatus.PENDING: (
        "Perduota vykdytojui!",
        "„{title}“ perduota tvarkyti{institution}.",
    ),
    ProblemStatus.ONGOING: (
        "Darbai prasidėjo!",
        "„{title}“ jau tvarkoma{institution}.",
    ),
    ProblemStatus.COMPLETED: (
        "Pažymėta kaip sutvarkyta!",
        (
            "„{title}“ pažymėta sutvarkyta. Jei esate šalia, per valandą "
            "patvirtinkite ir gaukite taškų, o jei problema vis dar yra, "
            "atsakykite „Problema yra“."
        ),
    ),
    ProblemStatus.CANCELED: (
        "Problemos nebėra!",
        "Kaimynai pranešė, kad „{title}“ jau nebėra. Ačiū, kad tikrinate.",
    ),
}


_REOPENED_MESSAGE = (
    "Problema vis dar yra!",
    "Kaimynai pranešė, kad „{title}“ dar nesutvarkyta, todėl ji grąžinta į sąrašą.",
)

# Why someone was paid; see `problems.lifecycle`.
_POINTS_REASONS: dict[str, str] = {
    "report_confirmed": "Kaimynai patvirtino jūsų pranešimą „{title}“.",
    "report_city": "Savivaldybė ėmėsi jūsų pranešimo „{title}“.",
    "answer_confirmed": "Jūsų atsakymas padėjo patvirtinti „{title}“.",
    "answer_city": "Savivaldybė ėmėsi „{title}“, kaip ir sakėte.",
    "fix_confirmed": "Ačiū, kad patvirtinote: „{title}“ sutvarkyta.",
    "fix_claim": "Kaimynai patvirtino, kad „{title}“ tikrai sutvarkyta.",
}


def _title(problem: "Problem") -> str:
    """Return how messages name `problem`."""
    return problem.title or problem.category.name


def status_message(problem: "Problem", *, reopened: bool = False) -> str:
    """Return the Lithuanian notification text for `problem`'s current status."""
    headline, body = _REOPENED_MESSAGE if reopened else _STATUS_MESSAGES[problem.status]
    institution = problem.institution
    return f"{headline} " + body.format(
        title=_title(problem),
        institution=f" ({institution.name})" if institution is not None else "",
    )


def notify_points(
    user: "User",
    problem: "Problem",
    points: int,
    reason: str,
) -> Notification:
    """Tell `user` they earned `points` on `problem`, and why."""
    body = _POINTS_REASONS[reason].format(title=_title(problem))
    return Notification.objects.create(
        user=user,
        message=f"Gavote {points} tšk.! {body}",
        event_type=EVENT_POINTS_AWARDED,
        problem=problem,
    )


def notify_badge(user: "User", badge: "Badge") -> Notification:
    """Tell `user` they earned `badge`."""
    return Notification.objects.create(
        user=user,
        message=f"Naujas ženklelis! „{badge.name}“: {badge.description.lower()}.",
        event_type=EVENT_BADGE_AWARDED,
    )


def notify_problem_status_change(
    problem: "Problem",
    *,
    exclude: "Iterable[User]" = (),
    reopened: bool = False,
) -> list[Notification]:
    """
    Notify every reporter and validator that `problem`'s status changed.

    Users in `exclude` are skipped: they were just told by a points
    notification, or caused the change themselves.
    """
    # `values_list(flat=True)` yields rows typed `Any`; declare what they are.
    skipped = list(exclude)
    reporter_ids: Iterable[int] = (
        Report.objects.filter(problem=problem)
        .exclude(user__in=skipped)
        .values_list("user_id", flat=True)
    )
    validator_ids: Iterable[int] = (
        Validation.objects.filter(problem=problem)
        .exclude(user__in=skipped)
        .values_list("user_id", flat=True)
    )
    message = status_message(problem, reopened=reopened)
    notifications = [
        Notification(
            user_id=user_id,
            message=message,
            event_type=EVENT_STATUS_CHANGED,
            problem=problem,
        )
        for user_id in set(reporter_ids) | set(validator_ids)
    ]
    return Notification.objects.bulk_create(notifications)
