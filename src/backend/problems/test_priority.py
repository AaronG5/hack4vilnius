"""Tests for the priority score (`problems.priority`), against planning/PRIORITY.md."""

import datetime as dt
from itertools import count
from typing import cast

import pytest
from categories.models import Category
from django.utils import timezone
from problems.models import Problem
from problems.priority import (
    DANGER_MAX,
    PLACE_MAX,
    REOPENED_POINTS,
    WAITING_MAX,
    band_of,
    danger,
    priority_of,
    signals,
    waiting,
)
from reports.models import Report
from rest_framework.test import APIClient
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

_numbers = count()
DANGEROUS = ProblemUrgency.DANGEROUS_TO_LIFE
URGENT = ProblemUrgency.URGENT
CAN_WAIT = ProblemUrgency.CAN_WAIT

# The worked examples in planning/PRIORITY.md, "Priority".
SCHOOL_CROSSING = 74
REOPENED_POTHOLE = 54
NEW_BIN = 19
GAMED_BIN = 40
FAKE_CONFIRMATIONS = 20
DISTRUSTED = 14.0
RELIABLE = 80.0
WEEK_DAYS = 7
MONTH_DAYS = 30
WEEK_POINTS = 9.1


def _resident(trust: float = 50.0) -> User:
    """Create a resident with the given trust."""
    user = User.objects.create_user(
        f"priority{next(_numbers)}@example.com",
        "a-very-sturdy-passphrase",
    )
    user.trust_score = trust
    user.save(update_fields=["trust_score"])
    return user


def _problem(
    category: Category,
    *,
    urgency: str,
    reporter: User,
    days_old: float = 0,
) -> Problem:
    """Create a confirmed problem with its first report, `days_old` days ago."""
    problem = Problem.objects.create(
        status=ProblemStatus.CONFIRMED,
        urgency=urgency,
        reported_urgency=urgency,
        legitimacy_score=50.0,
        location={"type": "Point", "coordinates": [25.28, 54.69]},
        category=category,
    )
    created = timezone.now() - dt.timedelta(days=days_old)
    _ = Problem.objects.filter(id=problem.id).update(created_at=created)
    _ = Report.objects.create(description="Reported.", user=reporter, problem=problem)
    problem.refresh_from_db()
    return problem


def _answer(
    problem: Problem,
    user: User,
    urgency: str = "",
    hours_ago: float = 1,
) -> None:
    """Add a "Problema yra" answer with an urgency vote, `hours_ago` hours ago."""
    answer = Validation.objects.create(
        is_valid=True,
        urgency=urgency,
        user=user,
        problem=problem,
    )
    _ = Validation.objects.filter(id=answer.id).update(
        created_at=timezone.now() - dt.timedelta(hours=hours_ago),
    )


def _score(problem: Problem) -> int:
    """Return the problem's score, which must exist."""
    priority = priority_of(problem)
    assert priority is not None
    return priority["score"]


class TestFactors:
    """Each factor on its own."""

    def test_danger_is_the_average_vote(self) -> None:
        """All dangerous is the maximum; all "can wait" a third of it."""
        assert danger({DANGEROUS: 3})["points"] == DANGER_MAX
        assert danger({CAN_WAIT: 2})["points"] == round(DANGER_MAX / 3, 1)

    def test_waiting_grows_slowly_then_caps(self) -> None:
        """A week is worth 9; a month or more the full 15."""
        assert waiting(WEEK_DAYS)["points"] == WEEK_POINTS
        assert waiting(MONTH_DAYS)["points"] == WAITING_MAX
        assert waiting(MONTH_DAYS * 4)["points"] == WAITING_MAX

    def test_signals_add_up_to_their_ceiling(self) -> None:
        """A reopening alone is worth 6; with momentum, the full 10."""
        assert signals(reopened=True, recent_answers=0)["points"] == REOPENED_POINTS
        assert signals(reopened=True, recent_answers=2)["points"] == REOPENED_POINTS + 4

    def test_bands(self) -> None:
        """The documented band boundaries."""
        assert [band_of(s) for s in (70, 69, 50, 49, 30, 29)] == [
            "critical",
            "high",
            "high",
            "medium",
            "medium",
            "low",
        ]


@pytest.mark.django_db
class TestWorkedExamples:
    """The four examples in planning/PRIORITY.md score as documented."""

    def test_unlit_school_crossing(self, category: Category) -> None:
        """Dangerous, by a school, three residents, five days old: critical."""
        crossing = _problem(
            category,
            urgency=DANGEROUS,
            reporter=_resident(),
            days_old=5,
        )
        crossing.near_sensitive = True
        crossing.save(update_fields=["near_sensitive"])
        # Answered four days ago: no recent burst of confirmations.
        _answer(crossing, _resident(), DANGEROUS, hours_ago=96)
        _answer(crossing, _resident(), DANGEROUS, hours_ago=96)

        priority = priority_of(crossing)

        assert priority is not None
        assert priority["score"] == SCHOOL_CROSSING
        assert priority["band"] == "critical"
        assert priority["factors"][2]["points"] == PLACE_MAX

    def test_reopened_pothole(self, category: Category) -> None:
        """Urgent, two reliable residents, ten days old, reopened once: high."""
        pothole = _problem(
            category,
            urgency=URGENT,
            reporter=_resident(RELIABLE),
            days_old=10,
        )
        _answer(pothole, _resident(RELIABLE), URGENT, hours_ago=120)
        pothole.reopened_at = timezone.now() - dt.timedelta(days=2)
        pothole.save(update_fields=["reopened_at"])

        assert _score(pothole) == REOPENED_POTHOLE

    def test_new_bin(self, category: Category) -> None:
        """Can wait, just reported by a newcomer: low."""
        bin_ = _problem(category, urgency=CAN_WAIT, reporter=_resident())

        assert _score(bin_) == NEW_BIN

    def test_bin_with_fake_confirmations(self, category: Category) -> None:
        """Twenty distrusted confirmations lift it a band, but not past danger."""
        bin_ = _problem(category, urgency=CAN_WAIT, reporter=_resident())
        for _ in range(FAKE_CONFIRMATIONS):
            _answer(bin_, _resident(DISTRUSTED), CAN_WAIT)

        assert _score(bin_) == GAMED_BIN
        assert _score(bin_) < SCHOOL_CROSSING


@pytest.mark.django_db
class TestWhatCounts:
    """Which problems get a score, and what feeds it."""

    def test_fixed_and_canceled_problems_have_none(self, category: Category) -> None:
        """Only open problems need a crew."""
        for status in (ProblemStatus.COMPLETED, ProblemStatus.CANCELED):
            problem = _problem(category, urgency=URGENT, reporter=_resident())
            problem.status = status
            assert priority_of(problem) is None

    def test_refuted_claims_are_not_evidence(self, category: Category) -> None:
        """Answers proved wrong add nothing."""
        problem = _problem(category, urgency=URGENT, reporter=_resident())
        before = _score(problem)
        _answer(problem, _resident())
        _ = Validation.objects.filter(problem=problem).update(refuted=True)

        assert _score(problem) == before

    def test_the_api_returns_the_breakdown(
        self,
        api_client: APIClient,
        category: Category,
    ) -> None:
        """`GET /api/problems/{id}` carries the score, band and five factors."""
        problem = _problem(category, urgency=URGENT, reporter=_resident())

        response = api_client.get(f"/api/problems/{problem.id}")

        body = cast("dict[str, object]", response.data)
        priority = cast("dict[str, object]", body["priority"])
        factors = cast("list[dict[str, object]]", priority["factors"])
        assert priority["band"] in {"critical", "high", "medium", "low"}
        assert [factor["key"] for factor in factors] == [
            "danger",
            "evidence",
            "place",
            "waiting",
            "signals",
        ]
