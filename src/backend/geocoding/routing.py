"""
Walking routes along real streets and paths, via an OSRM foot router.

The route planner in the app picks which problems to visit; this turns its
stops into a path to walk. Like address lookup, it runs here rather than in
the browser so the public OpenStreetMap service sees one polite caller with
a user agent, and repeated routes come from the cache.
"""

from functools import lru_cache
from typing import TYPE_CHECKING, Final, NamedTuple, cast

import requests
from django.conf import settings

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

# OSRM's demo servers and most self-hosted ones accept up to 100 points; a
# walk worth planning has far fewer, so this also caps abuse.
MAX_STOPS: Final = 12
_TIMEOUT_SECONDS: Final = 8.0
_CACHE_SIZE: Final = 128


class RoutingError(Exception):
    """The upstream router is unreachable, slow, broken or found no path."""


class Leg(NamedTuple):
    """One stretch of the walk, between two consecutive stops."""

    distance_m: float
    duration_s: float


class WalkingRoute(NamedTuple):
    """A walk through the stops, in their order."""

    distance_m: float
    duration_s: float
    # GeoJSON LineString coordinates, `[longitude, latitude]` pairs.
    path: tuple[tuple[float, float], ...]
    legs: tuple[Leg, ...]


def _request_route(stops: str) -> "Mapping[str, object]":
    """Ask the router for a walk through `stops` ("lng,lat;lng,lat;...")."""
    base = cast("str", settings.WALKING_ROUTER_URL).rstrip("/")
    try:
        response = requests.get(
            f"{base}/{stops}",
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            headers={"User-Agent": cast("str", settings.GEOCODER_USER_AGENT)},
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return cast("Mapping[str, object]", response.json())
    except (requests.RequestException, ValueError) as error:
        msg = "The walking router did not answer."
        raise RoutingError(msg) from error


def _number(value: object) -> float:
    """Read a number from the router's JSON, refusing anything else."""
    if not isinstance(value, int | float):
        msg = "The walking router answered with an unexpected shape."
        raise RoutingError(msg)
    return float(value)


def _path(geometry: object) -> tuple[tuple[float, float], ...]:
    """Read a GeoJSON LineString's coordinates."""
    if not isinstance(geometry, dict):
        msg = "The walking router returned no path."
        raise RoutingError(msg)
    coordinates = cast("Mapping[str, object]", geometry).get("coordinates")
    if not isinstance(coordinates, list):
        msg = "The walking router returned no path."
        raise RoutingError(msg)
    pairs: list[tuple[float, float]] = []
    for pair in cast("Sequence[object]", coordinates):
        if not isinstance(pair, list):
            continue
        values = cast("Sequence[object]", pair)
        pairs.append((_number(values[0]), _number(values[1])))
    return tuple(pairs)


@lru_cache(maxsize=_CACHE_SIZE)
def walking_route(stops: tuple[tuple[float, float], ...]) -> WalkingRoute:
    """
    Return the walk through `stops` (`(longitude, latitude)`, in order).

    Raises `RoutingError` if the router can't be reached or finds no path.
    Cached: the same planned walk is drawn again every time the map opens.
    """
    document = _request_route(";".join(f"{lng:.6f},{lat:.6f}" for lng, lat in stops))
    routes = document.get("routes")
    if document.get("code") != "Ok" or not isinstance(routes, list) or not routes:
        msg = "The walking router found no path."
        raise RoutingError(msg)
    route = cast("Mapping[str, object]", cast("Sequence[object]", routes)[0])
    raw_legs = route.get("legs")
    legs: list[Leg] = []
    if isinstance(raw_legs, list):
        for raw in cast("Sequence[object]", raw_legs):
            leg = cast("Mapping[str, object]", raw)
            legs.append(
                Leg(
                    distance_m=_number(leg.get("distance")),
                    duration_s=_number(leg.get("duration")),
                ),
            )
    return WalkingRoute(
        distance_m=_number(route.get("distance")),
        duration_s=_number(route.get("duration")),
        path=_path(route.get("geometry")),
        legs=tuple(legs),
    )
