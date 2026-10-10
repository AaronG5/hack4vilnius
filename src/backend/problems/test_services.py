"""Tests for the (stubbed) problem scoring and clustering services."""

import pytest
from categories.models import Category
from problems.services import (
    determine_urgency,
    estimate_legitimacy_score,
    find_duplicate_problem,
)
from vilnius_backend.choices import ProblemUrgency

VILNIUS_POINT: dict[str, object] = {"type": "Point", "coordinates": [25.28, 54.69]}
NEUTRAL_SCORE = 50.0
MAX_SCORE = 100


@pytest.mark.django_db
class TestEstimateLegitimacyScore:
    """Tests for `estimate_legitimacy_score`."""

    def test_returns_a_neutral_default(self, category: Category) -> None:
        """Scoring is stubbed to a neutral 50%, inside the contract's 0-100."""
        score = estimate_legitimacy_score(category, "A large pothole.")

        assert score == NEUTRAL_SCORE
        assert 0 <= score <= MAX_SCORE


@pytest.mark.django_db
class TestDetermineUrgency:
    """Tests for `determine_urgency`."""

    def test_falls_back_to_the_category_default(self, category: Category) -> None:
        """Without AI estimation, the category's configured default is used."""
        assert determine_urgency(category, "A large pothole.") == ProblemUrgency.URGENT

    def test_uses_can_wait_when_the_category_has_no_default(self) -> None:
        """A category with a blank default urgency still yields a valid value."""
        category = Category(
            name="Unset",
            description="No default urgency.",
            icon="https://example.com/icons/unset.svg",
            default_urgency="",
        )

        assert determine_urgency(category, "Something.") == ProblemUrgency.CAN_WAIT


@pytest.mark.django_db
class TestFindDuplicateProblem:
    """Tests for `find_duplicate_problem`."""

    def test_never_matches_while_stubbed(self, category: Category) -> None:
        """Clustering is deferred, so no report is treated as a duplicate."""
        assert find_duplicate_problem(VILNIUS_POINT, category) is None
