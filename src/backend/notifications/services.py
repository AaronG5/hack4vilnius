"""
Notification-sending logic.

Deciding *who* gets notified and the exact message wording is simple
orchestration (not the kind of AI/trust-scoring logic this project defers),
so it's implemented directly rather than stubbed.
"""

from typing import TYPE_CHECKING

from notifications.constants import EVENT_STATUS_CHANGED
from notifications.models import Notification
from reports.models import Report
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

if TYPE_CHECKING:
    from collections.abc import Iterable

    from problems.models import Problem


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
        "Sutvarkyta!",
        (
            "Vykdytojas pažymėjo „{title}“ kaip sutvarkytą. "
            "Jei problema vis dar yra, praneškite iš naujo."
        ),
    ),
    ProblemStatus.CANCELED: (
        "Problemos nebėra!",
        "Kaimynai pranešė, kad „{title}“ jau nebėra. Ačiū, kad tikrinate.",
    ),
}


def status_message(problem: "Problem") -> str:
    """Return the Lithuanian notification text for `problem`'s current status."""
    headline, body = _STATUS_MESSAGES[problem.status]
    institution = problem.institution
    return f"{headline} " + body.format(
        title=problem.title or problem.category.name,
        institution=f" ({institution.name})" if institution is not None else "",
    )


def notify_problem_status_change(problem: "Problem") -> list[Notification]:
    """Notify every reporter and validator that `problem`'s status changed."""
    # `values_list(flat=True)` yields rows typed `Any`; declare what they are.
    reporter_ids: Iterable[int] = Report.objects.filter(problem=problem).values_list(
        "user_id",
        flat=True,
    )
    validator_ids: Iterable[int] = Validation.objects.filter(
        problem=problem,
    ).values_list(
        "user_id",
        flat=True,
    )
    message = status_message(problem)
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
