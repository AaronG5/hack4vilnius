"""
Problem classification, scoring and proximity logic.

Duplicate detection is real: it works on distance and category. AI-driven
legitimacy scoring and urgency estimation are still stubbed; callers get
sane, deterministic defaults in the meantime.
"""

import math
from typing import TYPE_CHECKING, cast

from problems.models import Problem
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

if TYPE_CHECKING:
    from categories.models import Category

# Problems someone may still be reporting: not fixed, not dismissed.
OPEN_STATUSES = frozenset(
    {
        ProblemStatus.UNCONFIRMED,
        ProblemStatus.CONFIRMED,
        ProblemStatus.PENDING,
        ProblemStatus.ONGOING,
    },
)

# A report this close to an open problem of the same category is the same
# problem: phone GPS is rarely better than this, so two residents standing at
# one pothole land within it.
MERGE_RADIUS_M = 25.0

_EARTH_RADIUS_M = 6_371_000.0
_POINT_LENGTH = 2

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


def point_of(location: object) -> tuple[float, float] | None:
    """Return a GeoJSON Point's `(longitude, latitude)`, or `None` if malformed."""
    if not isinstance(location, dict):
        return None
    coordinates = cast("dict[str, object]", location).get("coordinates")
    # Stored JSON, so a list: `[longitude, latitude]`.
    if not isinstance(coordinates, list):
        return None
    values = cast("list[object]", coordinates)
    if len(values) < _POINT_LENGTH:
        return None
    longitude, latitude = values[0], values[1]
    if not isinstance(longitude, int | float) or not isinstance(latitude, int | float):
        return None
    return float(longitude), float(latitude)


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Return the great-circle distance in metres between two `(lng, lat)`."""
    lng1, lat1 = map(math.radians, a)
    lng2, lat2 = map(math.radians, b)
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(h))


def nearby_problems(
    point: tuple[float, float],
    radius_m: float,
    category: "Category | None" = None,
) -> list[tuple[Problem, float]]:
    """
    Return open problems within `radius_m` of `point`, with their distance.

    With a `category`, problems in it come first; otherwise (and within each
    group) the nearest come first.
    """
    found: list[tuple[Problem, float]] = []
    candidates = Problem.objects.filter(status__in=OPEN_STATUSES).select_related(
        "category",
        "institution",
    )
    for problem in candidates:
        where = point_of(problem.location)
        if where is None:
            continue
        distance = distance_m(point, where)
        if distance <= radius_m:
            found.append((problem, distance))

    def rank(entry: tuple[Problem, float]) -> tuple[bool, float]:
        problem, distance = entry
        other_category = category is not None and problem.category.id != category.id
        return other_category, distance

    return sorted(found, key=rank)


def find_duplicate_problem(
    location: object,
    category: "Category",
) -> Problem | None:
    """
    Find the open problem a new report at `location` duplicates, if any.

    The nearest open problem in the same category within `MERGE_RADIUS_M`.
    Anything further apart is left for the reporter to decide, through
    `GET /api/problems/nearby`.
    """
    point = point_of(location)
    if point is None:
        return None
    for problem, _distance in nearby_problems(point, MERGE_RADIUS_M, category):
        if problem.category.id == category.id:
            return problem
    return None
