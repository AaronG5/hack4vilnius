"""
Challenge progress and rewards.

When a challenge ends, every participant who did at least one counting
action during it (a report or an answer, in its categories if it has any)
is paid its `reward_points` once. `settle_ended_challenges` does that; it is
safe to run any number of times, and runs from the `settle_challenges`
management command and whenever the challenge list is read.
Milestone tracking is still stubbed.
"""

import datetime as dt
from typing import TypedDict

import users.services as user_services
from challenges.models import Challenge, ChallengeReward
from django.utils import timezone
from notifications.services import notify_reward
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ChallengeStatus


class Milestone(TypedDict):
    """A single progress milestone shown on a challenge's detail page."""

    label: str
    target: int
    reached: bool


def get_milestones(challenge: "Challenge") -> list[Milestone]:
    """
    List the progress milestones for `challenge`.

    Stub: always returns an empty list (no milestones configured) until
    real milestone tracking is implemented.
    """
    # TODO:
    del challenge
    return []


def _took_part(user: User, challenge: Challenge) -> bool:
    """Whether `user` reported or answered within `challenge`'s dates and topics."""
    start = dt.datetime.combine(challenge.start_date, dt.time.min, tzinfo=dt.UTC)
    end = dt.datetime.combine(
        challenge.end_date + dt.timedelta(days=1),
        dt.time.min,
        tzinfo=dt.UTC,
    )
    reports = Report.objects.filter(
        user=user,
        created_at__gte=start,
        created_at__lt=end,
    )
    answers = Validation.objects.filter(
        user=user,
        created_at__gte=start,
        created_at__lt=end,
    )
    categories = challenge.categories.all()
    if categories.exists():
        reports = reports.filter(problem__category__in=categories)
        answers = answers.filter(problem__category__in=categories)
    return reports.exists() or answers.exists()


def settle_ended_challenges(today: dt.date | None = None) -> int:
    """
    Pay the rewards of challenges that have ended, and mark them ended.

    Returns how many rewards were paid. Paying is recorded per participant
    (`ChallengeReward`), so nobody is paid twice however often this runs.
    """
    today = today or timezone.localdate()
    paid = 0
    ended = Challenge.objects.filter(end_date__lt=today).exclude(
        status=ChallengeStatus.ENDED,
    )
    for challenge in ended:
        for user in challenge.participants.all():
            if ChallengeReward.objects.filter(challenge=challenge, user=user).exists():
                continue
            if not _took_part(user, challenge):
                continue
            _ = ChallengeReward.objects.create(
                challenge=challenge,
                user=user,
                points=challenge.reward_points,
            )
            user_services.award_points(user, challenge.reward_points)
            _ = notify_reward(
                user,
                challenge.reward_points,
                f"Iššūkis „{challenge.name}“ baigėsi. Ačiū, kad dalyvavote.",
            )
            paid += 1
        challenge.status = ChallengeStatus.ENDED
        challenge.save(update_fields=["status"])
    return paid
