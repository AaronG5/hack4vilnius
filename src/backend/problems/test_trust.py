"""Tests for trust (`problems.trust`) and how it gates confirmation."""

from itertools import count

import pytest
from problems.lifecycle import apply_city_status, record_answer
from problems.models import Problem
from problems.trust import (
    NEUTRAL_TRUST,
    compute_trust,
    recompute_trust,
    refute,
    weight,
)
from reports.models import Report
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus

_numbers = count()

# The table in planning/PRIORITY.md, "Trust": (right, wrong) -> trust.
DOCUMENTED_TRUST = {
    (0, 0): 50.0,
    (3, 0): 80.0,
    (10, 1): 84.6,
    (1, 3): 33.3,
    (0, 5): 14.3,
}
DISTRUSTED = 20.0
NEWCOMER_WEIGHT = 1.0


def _resident(trust: float = NEUTRAL_TRUST) -> User:
    """Create a resident with the given trust."""
    user = User.objects.create_user(
        f"trust{next(_numbers)}@example.com",
        "a-very-sturdy-passphrase",
    )
    user.trust_score = trust
    user.save(update_fields=["trust_score"])
    return user


def _says_it_is_there(problem: Problem, user: User) -> None:
    """Save and apply a "Problema yra" answer."""
    answer = Validation.objects.create(is_valid=True, user=user, problem=problem)
    record_answer(problem, answer)
    problem.refresh_from_db()


class TestComputeTrust:
    """The formula, against the documented table."""

    @pytest.mark.parametrize(("outcome", "expected"), DOCUMENTED_TRUST.items())
    def test_matches_the_documented_values(
        self,
        outcome: tuple[int, int],
        expected: float,
    ) -> None:
        """Each row of the table in planning/PRIORITY.md holds."""
        right, wrong = outcome

        assert round(compute_trust(right, wrong), 1) == expected


@pytest.mark.django_db
class TestTrustFromOutcomes:
    """Trust is learned from claims proved right or wrong."""

    def test_a_new_resident_is_neutral(self) -> None:
        """No known outcomes: trust 50, weight 1.0."""
        resident = _resident()

        assert recompute_trust(resident) == NEUTRAL_TRUST
        assert weight(resident) == NEWCOMER_WEIGHT

    def test_paid_claims_raise_it(self, problem: Problem, report: Report) -> None:
        """Confirming answers that were paid count as proved right."""
        del report
        first, second = _resident(), _resident()
        _says_it_is_there(problem, first)
        _says_it_is_there(problem, second)

        first.refresh_from_db()
        assert first.trust_score > NEUTRAL_TRUST

    def test_a_refuted_report_lowers_it(self, report: Report) -> None:
        """A claim proved wrong pulls trust below neutral."""
        refute(report)

        report.user.refresh_from_db()
        assert report.user.trust_score < NEUTRAL_TRUST

    def test_the_city_canceling_refutes_whoever_said_it_was_there(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """A problem canceled as not real proves its report and answers wrong."""
        answer = Validation.objects.create(
            is_valid=True,
            user=_resident(),
            problem=problem,
        )

        apply_city_status(problem, ProblemStatus.CANCELED)

        report.refresh_from_db()
        answer.refresh_from_db()
        assert report.refuted is True
        assert answer.refuted is True

    def test_a_reopened_fix_leaves_the_claimant_alone(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Problems come back; saying it was gone isn't proved wrong by that."""
        del report
        claimant = _resident()
        claim = Validation.objects.create(
            is_valid=False,
            user=claimant,
            problem=problem,
        )
        record_answer(problem, claim)
        problem.refresh_from_db()

        _says_it_is_there(problem, _resident())

        claim.refresh_from_db()
        claimant.refresh_from_db()
        assert problem.status != ProblemStatus.COMPLETED
        assert claim.refuted is False
        assert claimant.trust_score == NEUTRAL_TRUST


@pytest.mark.django_db
class TestTrustGatesConfirmation:
    """Two people besides the reporter, with a combined weight of 2.0."""

    def test_two_newcomers_confirm(self, problem: Problem, report: Report) -> None:
        """Weight 1.0 + 1.0 reaches 2.0."""
        del report
        _says_it_is_there(problem, _resident())
        _says_it_is_there(problem, _resident())

        assert problem.status == ProblemStatus.CONFIRMED

    def test_two_distrusted_residents_do_not(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """Weight 0.7 + 0.7 falls short, so a third person is needed."""
        del report
        _says_it_is_there(problem, _resident(DISTRUSTED))
        _says_it_is_there(problem, _resident(DISTRUSTED))
        assert problem.status == ProblemStatus.UNCONFIRMED

        _says_it_is_there(problem, _resident(DISTRUSTED))

        assert problem.status == ProblemStatus.CONFIRMED

    def test_the_reporter_does_not_confirm_their_own_problem(
        self,
        problem: Problem,
        report: Report,
    ) -> None:
        """The reporter answering too still leaves one person short."""
        _says_it_is_there(problem, report.user)
        _says_it_is_there(problem, _resident())

        assert problem.status == ProblemStatus.UNCONFIRMED
