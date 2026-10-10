"""Tests for status changes and the points ladder in `problems.lifecycle`."""

import datetime as dt
from itertools import count

import pytest
from django.utils import timezone
from notifications.models import Notification
from problems.lifecycle import (
    ANSWER_POINTS,
    FIX_WINDOW,
    REPORT_POINTS,
    apply_city_status,
    record_answer,
)
from problems.models import Problem
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

_numbers = count()


def _resident() -> User:
    """Create another resident."""
    return User.objects.create_user(
        f"resident{next(_numbers)}@example.com",
        "a-very-sturdy-passphrase",
    )


def _answer(problem: Problem, *, present: bool, user: User | None = None) -> Validation:
    """Save one resident's answer and apply it, as the API does."""
    answer = Validation.objects.create(
        is_valid=present,
        user=user or _resident(),
        problem=problem,
    )
    record_answer(problem, answer)
    answer.refresh_from_db()
    problem.refresh_from_db()
    return answer


def _points(user: User) -> int:
    """Return `user`'s current total."""
    user.refresh_from_db()
    return user.points


@pytest.mark.django_db
class TestConfirmingAProblem:
    """Reports and "it's there" answers are paid when the problem is confirmed."""

    def test_the_reporter_is_paid_only_on_confirmation(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Nothing for the report itself; the full reward once it's confirmed."""
        _ = _answer(problem, present=True)
        assert _points(report.user) == 0

        _ = _answer(problem, present=True)

        assert problem.status == ProblemStatus.CONFIRMED
        assert _points(report.user) == REPORT_POINTS

    def test_the_answers_that_confirm_are_paid(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The first answers, which decide, are each paid."""
        del report
        first = _answer(problem, present=True)
        second = _answer(problem, present=True)

        first.refresh_from_db()
        assert (first.points_awarded, second.points_awarded) == (
            ANSWER_POINTS,
            ANSWER_POINTS,
        )

    def test_a_later_answer_waits_for_the_city(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """An answer after confirmation is paid only once the city takes it on."""
        del report
        _ = _answer(problem, present=True)
        _ = _answer(problem, present=True)
        late = _answer(problem, present=True)
        assert late.points_awarded == 0

        apply_city_status(problem, ProblemStatus.ONGOING)

        late.refresh_from_db()
        assert late.points_awarded == ANSWER_POINTS

    def test_the_city_taking_it_on_pays_nobody_twice(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Claims paid at confirmation aren't paid again by the city."""
        _ = _answer(problem, present=True)
        _ = _answer(problem, present=True)

        apply_city_status(problem, ProblemStatus.PENDING)
        apply_city_status(problem, ProblemStatus.ONGOING)

        assert _points(report.user) == REPORT_POINTS

    def test_the_city_taking_an_unconfirmed_problem_pays_the_reporter(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The city acting is the strongest confirmation of all."""
        apply_city_status(problem, ProblemStatus.PENDING)

        assert _points(report.user) == REPORT_POINTS

    def test_a_second_report_counts_as_a_confirmation(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Another report of the same problem backs it up like an answer."""
        del report
        _ = _answer(problem, present=True)
        second = Report.objects.create(
            description="Same pothole.",
            user=_resident(),
            problem=problem,
        )

        record_answer(problem, second)

        problem.refresh_from_db()
        second.refresh_from_db()
        assert problem.status == ProblemStatus.CONFIRMED
        assert second.points_awarded == ANSWER_POINTS

    def test_payment_comes_with_a_notification(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Whoever is paid hears how much, and why."""
        _ = _answer(problem, present=True)
        _ = _answer(problem, present=True)

        note = Notification.objects.get(user=report.user)
        assert note.event_type == "points_awarded"
        assert note.message.startswith(f"Gavote {REPORT_POINTS} tšk.!")


@pytest.mark.django_db
class TestTheFixWindow:
    """A problem said to be gone stays on the map, green, for an hour."""

    def test_saying_it_is_gone_opens_the_window(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The claim alone earns nothing yet."""
        del report
        claim = _answer(problem, present=False)

        assert problem.status == ProblemStatus.COMPLETED
        assert problem.status_before_fix == ProblemStatus.UNCONFIRMED
        assert claim.points_awarded == 0

    def test_confirmations_pay_the_confirmer_and_the_claim(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """A neighbour confirming the fix proves the claim right too."""
        del report
        claim = _answer(problem, present=False)
        confirmation = _answer(problem, present=False)

        claim.refresh_from_db()
        assert confirmation.points_awarded == ANSWER_POINTS
        assert claim.points_awarded == ANSWER_POINTS

    def test_only_the_first_confirmations_are_paid(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The ladder: once enough have confirmed, the next earns nothing."""
        del report
        _ = _answer(problem, present=False)
        _ = _answer(problem, present=False)
        _ = _answer(problem, present=False)
        extra = _answer(problem, present=False)

        assert extra.points_awarded == 0

    def test_still_there_reopens_it(self, problem: Problem, report: Report) -> None:
        """One "it's there" in the window undoes the fix, and the claim isn't paid."""
        del report
        problem.status = ProblemStatus.CONFIRMED
        problem.save(update_fields=["status"])
        claim = _answer(problem, present=False)

        _ = _answer(problem, present=True)

        claim.refresh_from_db()
        assert problem.status == ProblemStatus.CONFIRMED
        assert problem.fixed_at is None
        assert problem.reopened_at is not None
        assert claim.points_awarded == 0

    def test_after_the_window_answers_change_nothing(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Once the hour is over, the problem has left the map for good."""
        del report
        _ = _answer(problem, present=False)
        problem.fixed_at = timezone.now() - FIX_WINDOW - dt.timedelta(minutes=1)
        problem.save(update_fields=["fixed_at"])

        late = _answer(problem, present=True)

        assert problem.status == ProblemStatus.COMPLETED
        assert late.points_awarded == 0

    def test_the_city_marking_it_fixed_opens_the_window(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Neighbours confirming the city's fix are paid; nobody claimed it."""
        del report
        problem.status = ProblemStatus.ONGOING
        problem.save(update_fields=["status"])

        apply_city_status(problem, ProblemStatus.COMPLETED)
        problem.refresh_from_db()
        confirmation = _answer(problem, present=False)

        assert problem.fix_claimed_by is None
        assert problem.status_before_fix == ProblemStatus.ONGOING
        assert confirmation.points_awarded == ANSWER_POINTS

    def test_answers_while_the_city_works_change_nothing(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Once the city owns the status, "it's gone" doesn't close it."""
        del report
        problem.status = ProblemStatus.ONGOING
        problem.save(update_fields=["status"])

        answer = _answer(problem, present=False)

        assert problem.status == ProblemStatus.ONGOING
        assert answer.points_awarded == 0
