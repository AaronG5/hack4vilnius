"""Tests for the (stubbed) validation scoring services."""

import pytest
from problems.models import Problem
from validations.models import Validation
from validations.services import calculate_points, evaluate_problem_validations

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
