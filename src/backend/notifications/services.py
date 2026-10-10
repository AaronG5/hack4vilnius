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
    status_label = ProblemStatus(problem.status).label
    message = f"A problem you're involved with is now {status_label}."
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
