"""Tests for the weekly goal bonus (`problems.rewards`)."""

import datetime as dt

import pytest
from django.utils import timezone
from notifications.models import Notification
from problems.models import Problem
from problems.rewards import WEEKLY_BONUS, WEEKLY_GOAL, check_weekly_bonus
from users.models import User
from validations.models import Validation, WeeklyBonus


def _proven_answers(user: User, problem: Problem, count: int) -> None:
    """Give `user` `count` paid answers, each on its own copy of `problem`."""
    for _ in range(count):
        copy = Problem.objects.create(
            status=problem.status,
            urgency=problem.urgency,
            legitimacy_score=50.0,
            location=problem.location,
            category=problem.category,
        )
        _ = Validation.objects.create(
            is_valid=True,
            user=user,
            problem=copy,
            points_awarded=10,
        )


@pytest.mark.django_db
class TestWeeklyBonus:
    """`WEEKLY_GOAL` answers proved right in one week earn `WEEKLY_BONUS` once."""

    def test_reaching_the_goal_pays_the_bonus(
        self, user: User, problem: Problem
    ) -> None:
        """The fifth proven answer of the week pays, and says so."""
        _proven_answers(user, problem, WEEKLY_GOAL)

        assert check_weekly_bonus(user) is True
        user.refresh_from_db()
        assert user.points == WEEKLY_BONUS
        assert Notification.objects.get(user=user).message.startswith(
            f"Gavote {WEEKLY_BONUS} tšk.!",
        )

    def test_short_of_the_goal_pays_nothing(self, user: User, problem: Problem) -> None:
        """Four proven answers aren't enough."""
        _proven_answers(user, problem, WEEKLY_GOAL - 1)

        assert check_weekly_bonus(user) is False

    def test_unproven_answers_do_not_count(self, user: User, problem: Problem) -> None:
        """Answers that haven't proved right yet don't reach the goal."""
        _proven_answers(user, problem, WEEKLY_GOAL)
        _ = Validation.objects.filter(user=user).update(points_awarded=0)

        assert check_weekly_bonus(user) is False

    def test_paid_once_per_week(self, user: User, problem: Problem) -> None:
        """More proven answers the same week don't pay again."""
        _proven_answers(user, problem, WEEKLY_GOAL)
        _ = check_weekly_bonus(user)
        _proven_answers(user, problem, WEEKLY_GOAL)

        assert check_weekly_bonus(user) is False
        assert WeeklyBonus.objects.count() == 1

    def test_last_weeks_answers_do_not_count(
        self,
        user: User,
        problem: Problem,
    ) -> None:
        """The goal is per week (Monday to Sunday, Vilnius time)."""
        _proven_answers(user, problem, WEEKLY_GOAL)
        _ = Validation.objects.filter(user=user).update(
            created_at=timezone.now() - dt.timedelta(days=8),
        )

        assert check_weekly_bonus(user) is False
