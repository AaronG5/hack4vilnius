"""Tests for the badge-awarding service."""

import pytest
from badges.models import Badge, UserBadge
from badges.services import check_new_badges
from challenges.models import Challenge
from notifications.models import Notification
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import BadgeRule

PROVEN_NEEDED = 2


def _badge(rule: str, **extra: object) -> Badge:
    """Create a badge earned by `rule`."""
    return Badge.objects.create(
        name=f"Badge {rule}",
        description="A badge",
        icon="https://example.com/badge.svg",
        criteria="A rule.",
        rule=rule,
        **extra,
    )


@pytest.mark.django_db
class TestCheckNewBadges:
    """Tests for `check_new_badges`."""

    def test_a_first_report_earns_the_first_report_badge(
        self,
        user: User,
        report: Report,
    ) -> None:
        """Filing any report is enough."""
        del report
        badge = _badge(BadgeRule.FIRST_REPORT)

        assert check_new_badges(user) == [badge]
        assert UserBadge.objects.filter(user=user, badge=badge).exists()

    def test_only_answers_that_proved_right_count(
        self,
        other_user: User,
        problem: Problem,
    ) -> None:
        """An unpaid answer doesn't count toward the answers badge."""
        badge = _badge(
            BadgeRule.PROVEN_ANSWERS,
            required_validation_count=PROVEN_NEEDED,
        )
        _ = Validation.objects.create(is_valid=True, user=other_user, problem=problem)
        assert check_new_badges(other_user) == []

        _ = Validation.objects.filter(user=other_user).update(points_awarded=10)
        assert check_new_badges(other_user) == []

        other = Problem.objects.create(
            status=problem.status,
            urgency=problem.urgency,
            legitimacy_score=50.0,
            location=problem.location,
            category=problem.category,
        )
        _ = Validation.objects.create(
            is_valid=True,
            user=other_user,
            problem=other,
            points_awarded=10,
        )
        assert check_new_badges(other_user) == [badge]

    def test_joining_the_challenge_earns_its_badge(
        self,
        user: User,
        challenge: Challenge,
    ) -> None:
        """A challenge badge goes to its participants."""
        badge = _badge(BadgeRule.CHALLENGE, challenge=challenge)
        assert check_new_badges(user) == []

        challenge.participants.add(user)

        assert check_new_badges(user) == [badge]

    def test_a_badge_is_earned_once_and_announced(
        self,
        user: User,
        report: Report,
    ) -> None:
        """Checking again awards nothing new; the first time sends a notification."""
        del report
        _ = _badge(BadgeRule.FIRST_REPORT)

        _ = check_new_badges(user)

        assert check_new_badges(user) == []
        note = Notification.objects.get(user=user)
        assert note.event_type == "badge_awarded"
        assert note.message.startswith("Naujas ženklelis!")

    def test_badges_without_a_rule_are_left_to_staff(
        self,
        user: User,
        report: Report,
        badge: Badge,
    ) -> None:
        """A badge with no rule is never awarded automatically."""
        del report, badge

        assert check_new_badges(user) == []
