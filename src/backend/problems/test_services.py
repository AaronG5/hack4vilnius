"""Tests for the problem scoring and proximity services."""

import pytest
from categories.models import Category
from problems.models import Problem
from problems.services import (
    determine_urgency,
    distance_m,
    estimate_legitimacy_score,
    find_duplicate_problem,
    nearby_problems,
    point_of,
)
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

VILNIUS_POINT: dict[str, object] = {"type": "Point", "coordinates": [25.28, 54.69]}
NEUTRAL_SCORE = 50.0
MAX_SCORE = 100
# One thousandth of a degree of latitude, in metres.
METRES_PER_MILLIDEGREE = 111.2


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


def _at(longitude: float, latitude: float) -> dict[str, object]:
    """Return a GeoJSON Point."""
    return {"type": "Point", "coordinates": [longitude, latitude]}


def _problem(
    category: Category,
    location: dict[str, object],
    status: str = ProblemStatus.UNCONFIRMED,
) -> Problem:
    """Create a problem in `category` at `location`."""
    return Problem.objects.create(
        status=status,
        urgency=ProblemUrgency.URGENT,
        legitimacy_score=50.0,
        location=location,
        category=category,
    )


# About 11 m and 111 m north of VILNIUS_POINT.
NEAR = _at(25.28, 54.6901)
FURTHER = _at(25.28, 54.691)


class TestDistance:
    """Tests for `distance_m` and `point_of`."""

    def test_measures_metres_on_the_ground(self) -> None:
        """A thousandth of a degree of latitude is about 111 m."""
        distance = distance_m((25.28, 54.69), (25.28, 54.691))

        assert abs(distance - METRES_PER_MILLIDEGREE) < 1

    def test_reads_a_geojson_point(self) -> None:
        """Coordinates come back as `(longitude, latitude)`."""
        assert point_of(VILNIUS_POINT) == (25.28, 54.69)

    def test_rejects_malformed_locations(self) -> None:
        """Anything that isn't a two-number Point yields `None`."""
        for location in ({}, {"coordinates": "x"}, {"coordinates": [1]}, "nope"):
            assert point_of(location) is None


@pytest.mark.django_db
class TestNearbyProblems:
    """Tests for `nearby_problems`."""

    def test_finds_open_problems_within_the_radius(self, category: Category) -> None:
        """Only problems inside the radius are returned, nearest first."""
        further = _problem(category, FURTHER)
        near = _problem(category, NEAR)

        found = nearby_problems((25.28, 54.69), 200)

        assert [problem for problem, _ in found] == [near, further]
        assert nearby_problems((25.28, 54.69), 50) == [(near, found[0][1])]

    def test_skips_fixed_and_dismissed_problems(self, category: Category) -> None:
        """A completed or canceled problem can't be reported again."""
        _ = _problem(category, NEAR, ProblemStatus.COMPLETED)
        _ = _problem(category, NEAR, ProblemStatus.CANCELED)

        assert nearby_problems((25.28, 54.69), 200) == []

    def test_puts_the_same_category_first(
        self,
        category: Category,
        other_category: Category,
    ) -> None:
        """A further problem of the asked-for category beats a nearer other one."""
        near_other = _problem(other_category, NEAR)
        further_same = _problem(category, FURTHER)

        found = nearby_problems((25.28, 54.69), 200, category)

        assert [problem for problem, _ in found] == [further_same, near_other]


@pytest.mark.django_db
class TestFindDuplicateProblem:
    """Tests for `find_duplicate_problem`."""

    def test_matches_an_open_problem_a_few_metres_away(
        self,
        category: Category,
    ) -> None:
        """Same category within the merge radius is the same problem."""
        near = _problem(category, NEAR)

        assert find_duplicate_problem(VILNIUS_POINT, category) == near

    def test_leaves_further_problems_to_the_reporter(
        self,
        category: Category,
    ) -> None:
        """Beyond the merge radius, nothing is merged automatically."""
        _ = _problem(category, FURTHER)

        assert find_duplicate_problem(VILNIUS_POINT, category) is None

    def test_ignores_other_categories(
        self,
        category: Category,
        other_category: Category,
    ) -> None:
        """A streetlight next to a pothole is a different problem."""
        _ = _problem(other_category, NEAR)

        assert find_duplicate_problem(VILNIUS_POINT, category) is None
