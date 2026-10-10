"""
Validation scoring and problem-confirmation logic. Stubbed for now.

Real point calculation (weighted by media/description quality) and the
confirmed/canceled decision once "enough" validations are in are left for
later; callers get sane, deterministic defaults in the meantime.
"""

from typing import TYPE_CHECKING

from problems.models import Problem

if TYPE_CHECKING:
    from validations.models import Validation

_DEFAULT_POINTS_AWARDED = 10


def calculate_points(problem: Problem, validation: "Validation") -> int:
    """
    Calculate points earned by submitting a validation.

    Stub: always awards a flat default amount, regardless of validation
    quality (extra media, description detail) or the problem's urgency.
    """
    del problem, validation
    return _DEFAULT_POINTS_AWARDED


def evaluate_problem_validations(problem: "Problem") -> None:
    """
    Check whether `problem` has enough validations to confirm/cancel it.

    Stub: a no-op. Real logic will compare validation counts/weights
    against the problem's urgency and legitimacy score, then transition
    its status and notify involved users.
    """
    del problem
