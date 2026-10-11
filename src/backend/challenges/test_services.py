"""Tests for paying challenge rewards (`challenges.services`)."""

import datetime as dt

import pytest
from categories.models import Category
from challenges.models import Challenge, ChallengeReward
from challenges.services import settle_ended_challenges
from django.utils import timezone
from problems.models import Problem
from reports.models import Report
from rest_framework.test import APIClient
from users.models import User
from vilnius_backend.choices import ChallengeStatus

# The `challenge` fixture runs 2026-03-01 to 2026-04-01 with 500 points.
REWARD = 500
AFTER_THE_END = dt.date(2026, 4, 2)
DURING = dt.datetime(2026, 3, 15, 12, tzinfo=dt.UTC)


def _report_during(user: User, problem: Problem) -> None:
    """File a report by `user` dated inside the challenge."""
    report = Report.objects.create(description="Pothole.", user=user, problem=problem)
    _ = Report.objects.filter(id=report.id).update(created_at=DURING)


@pytest.mark.django_db
class TestSettleEndedChallenges:
    """Participants who took part are paid once the challenge ends."""

    def test_pays_participants_who_took_part(
        self,
        challenge: Challenge,
        user: User,
        problem: Problem,
    ) -> None:
        """A report in the challenge's category and dates earns its reward."""
        challenge.participants.add(user)
        _report_during(user, problem)

        assert settle_ended_challenges(AFTER_THE_END) == 1
        user.refresh_from_db()
        challenge.refresh_from_db()
        assert user.points == REWARD
        assert challenge.status == ChallengeStatus.ENDED

    def test_joining_without_acting_earns_nothing(
        self,
        challenge: Challenge,
        user: User,
    ) -> None:
        """A participant needs at least one counting action."""
        challenge.participants.add(user)

        assert settle_ended_challenges(AFTER_THE_END) == 0

    def test_actions_outside_its_categories_do_not_count(
        self,
        challenge: Challenge,
        user: User,
        problem: Problem,
        other_category: Category,
    ) -> None:
        """A report in another category doesn't take part in a pothole challenge."""
        challenge.categories.set([other_category])
        challenge.participants.add(user)
        _report_during(user, problem)

        assert settle_ended_challenges(AFTER_THE_END) == 0

    def test_nothing_is_paid_twice(
        self,
        challenge: Challenge,
        user: User,
        problem: Problem,
    ) -> None:
        """Running it again pays nobody again."""
        challenge.participants.add(user)
        _report_during(user, problem)
        _ = settle_ended_challenges(AFTER_THE_END)
        challenge.status = ChallengeStatus.ACTIVE
        challenge.save(update_fields=["status"])

        assert settle_ended_challenges(AFTER_THE_END) == 0
        assert ChallengeReward.objects.count() == 1

    def test_a_running_challenge_is_left_alone(
        self,
        challenge: Challenge,
        user: User,
        problem: Problem,
    ) -> None:
        """Before its end date, nothing is paid."""
        challenge.participants.add(user)
        _report_during(user, problem)

        assert settle_ended_challenges(challenge.end_date) == 0

    def test_reading_the_list_settles_ended_challenges(
        self,
        api_client: APIClient,
        challenge: Challenge,
        user: User,
        problem: Problem,
    ) -> None:
        """Ended challenges pay out even without the scheduled command."""
        challenge.participants.add(user)
        _report_during(user, problem)
        assert timezone.localdate() > challenge.end_date

        _ = api_client.get("/api/challenges")

        user.refresh_from_db()
        assert user.points == REWARD
