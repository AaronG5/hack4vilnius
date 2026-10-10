"""Tests for validation scoring and the urgency tally."""

import pytest
from problems.models import Problem
from users.models import User
from validations.models import Validation
from validations.services import (
    apply_urgency_votes,
    calculate_points,
    evaluate_problem_validations,
    urgency_votes,
)
from vilnius_backend.choices import ProblemUrgency

FLAT_AWARD = 10


@pytest.mark.django_db
class TestCalculatePoints:
    """Tests for `calculate_points`."""

    def test_awards_a_flat_default(
        self,
        problem: Problem,
        validation: Validation,
    ) -> None:
        """Quality-weighted scoring is deferred, so the award is a flat amount."""
        assert calculate_points(problem, validation) == FLAT_AWARD

    def test_does_not_yet_depend_on_the_verdict(
        self,
        problem: Problem,
        validation: Validation,
    ) -> None:
        """A disputing validation earns the same stubbed amount for now."""
        validation.is_valid = False

        assert calculate_points(problem, validation) == FLAT_AWARD


@pytest.mark.django_db
class TestEvaluateProblemValidations:
    """Tests for `evaluate_problem_validations`."""

    def test_leaves_the_status_alone(
        self,
        problem: Problem,
        validation: Validation,
    ) -> None:
        """The confirm/cancel transition is deferred, so nothing changes."""
        del validation
        before = problem.status

        evaluate_problem_validations(problem)

        problem.refresh_from_db()
        assert problem.status == before


def _vote(problem: Problem, user: User, urgency: str) -> Validation:
    """Record one resident's answer, with the urgency they voted for."""
    return Validation.objects.create(
        is_valid=True,
        description="Still here.",
        urgency=urgency,
        user=user,
        problem=problem,
    )


@pytest.mark.django_db
class TestUrgencyVotes:
    """Tests for `urgency_votes` and `apply_urgency_votes`."""

    def test_the_report_counts_as_the_reporter_s_vote(self, problem: Problem) -> None:
        """A problem nobody has answered yet still shows where it started."""
        problem.reported_urgency = ProblemUrgency.URGENT
        problem.save(update_fields=["reported_urgency"])

        assert urgency_votes(problem)[ProblemUrgency.URGENT] == 1

    def test_counts_each_answer_that_carried_an_urgency(
        self,
        problem: Problem,
        user: User,
        other_user: User,
    ) -> None:
        """Answers with no urgency are not votes."""
        problem.reported_urgency = ProblemUrgency.CAN_WAIT
        problem.save(update_fields=["reported_urgency"])
        _ = _vote(problem, user, ProblemUrgency.DANGEROUS_TO_LIFE)
        _ = _vote(problem, other_user, "")

        tally = urgency_votes(problem)

        assert tally[ProblemUrgency.CAN_WAIT] == 1
        assert tally[ProblemUrgency.DANGEROUS_TO_LIFE] == 1

    def test_the_majority_decides(
        self,
        problem: Problem,
        user: User,
        other_user: User,
    ) -> None:
        """Two residents agreeing outweigh the single reporter."""
        problem.urgency = ProblemUrgency.CAN_WAIT
        problem.reported_urgency = ProblemUrgency.CAN_WAIT
        problem.save(update_fields=["urgency", "reported_urgency"])
        _ = _vote(problem, user, ProblemUrgency.URGENT)
        _ = _vote(problem, other_user, ProblemUrgency.URGENT)

        apply_urgency_votes(problem)

        assert problem.urgency == ProblemUrgency.URGENT

    def test_a_tie_goes_to_the_more_severe(
        self,
        problem: Problem,
        user: User,
    ) -> None:
        """Under-reacting to something dangerous costs more than over-reacting."""
        problem.urgency = ProblemUrgency.CAN_WAIT
        problem.reported_urgency = ProblemUrgency.CAN_WAIT
        problem.save(update_fields=["urgency", "reported_urgency"])
        _ = _vote(problem, user, ProblemUrgency.DANGEROUS_TO_LIFE)

        apply_urgency_votes(problem)

        assert problem.urgency == ProblemUrgency.DANGEROUS_TO_LIFE

    def test_re_tallying_does_not_drift(
        self,
        problem: Problem,
        user: User,
    ) -> None:
        """Applying the same votes twice reaches the same answer."""
        problem.urgency = ProblemUrgency.URGENT
        problem.reported_urgency = ProblemUrgency.URGENT
        problem.save(update_fields=["urgency", "reported_urgency"])
        _ = _vote(problem, user, ProblemUrgency.CAN_WAIT)

        apply_urgency_votes(problem)
        first = problem.urgency
        apply_urgency_votes(problem)

        assert problem.urgency == first
