"""
Logic that depends on geographic computation. Stubbed for now.

Real point-in-polygon resolution against district boundaries is left for
later; callers get a sane, deterministic default in the meantime.
"""

from typing import TYPE_CHECKING

from districts.models import District

if TYPE_CHECKING:
    from collections.abc import Mapping


def get_district_for_point(point: "Mapping[str, object]") -> District | None:
    """
    Resolve the district containing a GeoJSON `Point`.

    Stub: always returns `None` (no district match) until real
    point-in-polygon boundary resolution is implemented.
    """
    # TODO:
    del point
    return None
