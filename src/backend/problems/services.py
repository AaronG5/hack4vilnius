"""
Problem classification/scoring logic. Stubbed for now.

Real AI-driven legitimacy scoring, urgency estimation and duplicate
detection are left for later; callers get sane, deterministic defaults in
the meantime so the rest of the system can be built against a stable
contract.
"""

from typing import TYPE_CHECKING

from vilnius_backend.choices import ProblemUrgency

if TYPE_CHECKING:
    from categories.models import Category
    from problems.models import Problem

_DEFAULT_LEGITIMACY_SCORE = 50.0


def estimate_legitimacy_score(category: "Category", description: str) -> float:
    """
    Estimate how legitimate a new report looks, as a 0-100 percentage.

    Stub: always returns a neutral default score.
    """
    # TODO:
    del category, description
    return _DEFAULT_LEGITIMACY_SCORE


def determine_urgency(category: "Category", description: str) -> str:
    """
    Estimate a problem's urgency from its report.

    Stub: always falls back to the category's configured default urgency.
    """
    # TODO:
    del description
    urgency = category.default_urgency
    return urgency if urgency else ProblemUrgency.CAN_WAIT


def find_duplicate_problem(
    location: dict[str, object],
    category: "Category",
) -> "Problem | None":
    """
    Find a nearby existing problem that a new report might duplicate.

    Stub: always returns `None` (never a duplicate) until real proximity
    clustering is implemented.
    """
    del location, category
    return None
