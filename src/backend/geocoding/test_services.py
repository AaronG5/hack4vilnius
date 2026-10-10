"""Tests for turning geocoder features into `Place`s."""

from collections.abc import Iterator, Mapping, Sequence
from typing import Any

import geocoding.services as geocoding_services
import pytest
from geocoding.services import GeocoderError, Place


def _feature(
    properties: Mapping[str, object],
    coordinates: object = (25.2834, 54.7050),
) -> dict[str, object]:
    """Build one GeoJSON feature as the geocoder returns it."""
    return {
        "type": "Feature",
        "properties": dict(properties),
        "geometry": {"type": "Point", "coordinates": list(coordinates)}  # pyright: ignore[reportCallIssue, reportArgumentType]
        if isinstance(coordinates, (list, tuple))
        else coordinates,
    }


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    """Keep each test's stubbed answers out of the next test's cache."""
    geocoding_services.search.cache_clear()
    yield
    geocoding_services.search.cache_clear()


def _stub(
    monkeypatch: pytest.MonkeyPatch,
    features: Sequence[Mapping[str, object]],
) -> None:
    """Answer the geocoder call with `features`, without touching the network."""

    def _fake(query: str, limit: int) -> Sequence[Mapping[str, object]]:
        del query, limit
        return features

    monkeypatch.setattr(geocoding_services, "_request_places", _fake)


class TestSearch:
    """Tests for `geocoding.services.search`."""

    def test_builds_an_address_from_street_and_house_number(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A street address reads as one line, with its area as another."""
        _stub(
            monkeypatch,
            [
                _feature(
                    {
                        "street": "Kalvarijų g.",
                        "housenumber": "98",
                        "locality": "Šnipiškės",
                        "city": "Vilnius",
                    },
                ),
            ],
        )

        assert geocoding_services.search("Kalvarijų 98", 5) == (
            Place(
                address="Kalvarijų g. 98",
                locality="Šnipiškės, Vilnius",
                latitude=54.7050,
                longitude=25.2834,
            ),
        )

    def test_falls_back_to_the_name_of_a_place_without_a_street(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A park or a landmark is named, not numbered."""
        _stub(monkeypatch, [_feature({"name": "Vingio parkas", "city": "Vilnius"})])

        places = geocoding_services.search("Vingio", 5)

        assert places[0].address == "Vingio parkas"
        assert places[0].locality == "Vilnius"

    def test_keeps_the_name_as_context_for_a_named_street_address(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A named address keeps the name, which says more than the street."""
        _stub(
            monkeypatch,
            [
                _feature(
                    {
                        "name": "Kilobaitas",
                        "street": "Kalvarijų g.",
                        "housenumber": "98",
                        "city": "Vilnius",
                    },
                ),
            ],
        )

        assert geocoding_services.search("Kilobaitas", 5)[0].locality == (
            "Kilobaitas, Vilnius"
        )

    def test_collapses_duplicates_of_the_same_address(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A building's node and its outline are one choice, not two."""
        same = {"street": "Pilies g.", "housenumber": "22", "city": "Vilnius"}
        _stub(monkeypatch, [_feature(same), _feature(same)])

        assert len(geocoding_services.search("Pilies 22", 5)) == 1

    def test_skips_features_that_cannot_be_placed(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A result with no coordinates or no name is dropped, not returned empty."""
        _stub(
            monkeypatch,
            [
                _feature({"street": "Pilies g."}, coordinates="not a point"),
                _feature({"city": "Vilnius"}),
                _feature({"street": "Pilies g.", "housenumber": "22"}),
            ],
        )

        places = geocoding_services.search("Pilies", 5)

        assert [place.address for place in places] == ["Pilies g. 22"]

    def test_no_matches_is_an_empty_result(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Nothing found is a normal answer, not an error."""
        _stub(monkeypatch, [])

        assert geocoding_services.search("qqqq", 5) == ()

    def test_caches_repeated_searches(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Typing an address asks for every prefix; the same query asks once."""
        calls = 0

        def _counting(query: str, limit: int) -> Sequence[Mapping[str, object]]:
            del query, limit
            nonlocal calls
            calls += 1
            return [_feature({"street": "Pilies g.", "housenumber": "22"})]

        monkeypatch.setattr(geocoding_services, "_request_places", _counting)

        _ = geocoding_services.search("Pilies 22", 5)
        _ = geocoding_services.search("Pilies 22", 5)

        assert calls == 1

    def test_an_upstream_failure_is_a_geocoder_error(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A broken geocoder surfaces as `GeocoderError`, not as a raw timeout."""

        def _broken(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
            del args, kwargs
            msg = "connection refused"
            raise geocoding_services.requests.ConnectionError(msg)

        monkeypatch.setattr(geocoding_services.requests, "get", _broken)

        with pytest.raises(GeocoderError):
            _ = geocoding_services.search("Pilies 22", 5)
