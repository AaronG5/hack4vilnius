"""
Turning a typed address into coordinates, via an external geocoder.

The lookup runs here rather than in the browser on purpose: OSM-based
geocoders ask callers to identify themselves and to keep request rates
low, which a page full of type-ahead requests can't promise (see
planning/FRONTEND_PLAN.md > API gaps). Routing it through the backend
also means one origin for the frontend and one place to cache.
"""

from functools import lru_cache
from typing import TYPE_CHECKING, Final, NamedTuple, cast

import requests
from django.conf import settings

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence


class Place(NamedTuple):
    """A geocoder result, as the API hands it to the frontend."""

    address: str
    locality: str
    latitude: float
    longitude: float


class GeocoderError(Exception):
    """The upstream geocoder is unreachable, slow or broken."""


# Bounding box and centre of Vilnius municipality: results are limited to the
# city and ranked by distance from the old town, so "Pilies g." means the one
# in Vilnius.
_VILNIUS_BBOX: Final = "25.02,54.56,25.48,54.83"
_VILNIUS_CENTRE: Final = (25.2797, 54.6872)
_TIMEOUT_SECONDS: Final = 5.0
_COORDINATE_PAIR: Final = 2
_CACHE_SIZE: Final = 256


def _request_places(query: str, limit: int) -> "Sequence[Mapping[str, object]]":
    """Ask the geocoder for `query`, returning its raw GeoJSON features."""
    longitude, latitude = _VILNIUS_CENTRE
    try:
        response = requests.get(
            cast("str", settings.GEOCODER_URL),
            params={
                "q": query,
                "limit": limit,
                "bbox": _VILNIUS_BBOX,
                "lon": longitude,
                "lat": latitude,
                # Local (Lithuanian) names rather than a translation.
                "lang": "default",
            },
            headers={"User-Agent": cast("str", settings.GEOCODER_USER_AGENT)},
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        document = cast("Mapping[str, object]", response.json())
    except (requests.RequestException, ValueError) as error:
        msg = "The geocoder did not answer."
        raise GeocoderError(msg) from error

    features = document.get("features")
    if not isinstance(features, list):
        return []
    return cast("Sequence[Mapping[str, object]]", features)


def _text(properties: "Mapping[str, object]", key: str) -> str:
    """Read a string property, treating anything else as missing."""
    value = properties.get(key)
    return value if isinstance(value, str) else ""


def _address(properties: "Mapping[str, object]") -> str:
    """Return the street line, "Kalvarijų g. 98", or the place's own name."""
    street = _text(properties, "street")
    if not street:
        return _text(properties, "name")
    number = _text(properties, "housenumber")
    return f"{street} {number}".strip()


def _locality(properties: "Mapping[str, object]") -> str:
    """Return what follows the street line: the neighbourhood and the city."""
    parts = [
        _text(properties, "name") if _text(properties, "street") else "",
        _text(properties, "locality") or _text(properties, "suburb"),
        _text(properties, "city"),
    ]
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return ", ".join(seen)


def _place(feature: "Mapping[str, object]") -> Place | None:
    """Build a `Place` from one GeoJSON feature, or `None` if it isn't usable."""
    geometry = feature.get("geometry")
    properties = feature.get("properties")
    if not isinstance(geometry, dict) or not isinstance(properties, dict):
        return None
    coordinates = cast("Mapping[str, object]", geometry).get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < _COORDINATE_PAIR:
        return None
    longitude, latitude = coordinates[0], coordinates[1]
    if not isinstance(longitude, int | float) or not isinstance(latitude, int | float):
        return None

    typed_properties = cast("Mapping[str, object]", properties)
    address = _address(typed_properties)
    if not address:
        return None
    return Place(
        address=address,
        locality=_locality(typed_properties),
        latitude=float(latitude),
        longitude=float(longitude),
    )


@lru_cache(maxsize=_CACHE_SIZE)
def search(query: str, limit: int) -> tuple[Place, ...]:
    """
    Find places in Vilnius matching `query`, best match first.

    Results are cached: a person typing an address asks for every prefix of
    it, and the same few streets are searched over and over.
    """
    places: list[Place] = []
    for feature in _request_places(query, limit):
        place = _place(feature)
        # Two results for the same building (its node and its outline) are one
        # choice as far as the person typing is concerned.
        if place is not None and all(place.address != seen.address for seen in places):
            places.append(place)
    return tuple(places)
