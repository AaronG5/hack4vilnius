"""Tests for the address lookup endpoint."""

from http import HTTPStatus
from typing import cast

import geocoding.services as geocoding_services
import pytest
from geocoding.services import GeocoderError, Place
from rest_framework.response import Response
from rest_framework.test import APIClient

GEOCODE_URL = "/api/geocode"

_PLACE = Place(
    address="Kalvarijų g. 98",
    locality="Šnipiškės, Vilnius",
    latitude=54.7050,
    longitude=25.2834,
)


def _body(response: Response) -> list[dict[str, object]]:
    """Return a response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _answer_with(
    monkeypatch: pytest.MonkeyPatch,
    places: tuple[Place, ...],
) -> None:
    """Stand in for the geocoder, so no test reaches the network."""

    def _fake(query: str, limit: int) -> tuple[Place, ...]:
        del query, limit
        return places

    monkeypatch.setattr(geocoding_services, "search", _fake)


@pytest.mark.django_db
class TestGeocode:
    """Tests for `GET /api/geocode`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """Looking up an address without a token is rejected."""
        response = api_client.get(GEOCODE_URL, {"q": "Kalvarijų 98"})

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_matching_places(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Each match carries the two display lines and its coordinates."""
        _answer_with(monkeypatch, (_PLACE,))

        response = auth_client.get(GEOCODE_URL, {"q": "Kalvarijų 98"})

        assert response.status_code == HTTPStatus.OK
        assert _body(response) == [
            {
                "address": "Kalvarijų g. 98",
                "locality": "Šnipiškės, Vilnius",
                "latitude": 54.7050,
                "longitude": 25.2834,
            },
        ]

    def test_no_match_is_an_empty_list(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """An address nobody can find is an empty 200, so the form can move on."""
        _answer_with(monkeypatch, ())

        response = auth_client.get(GEOCODE_URL, {"q": "qqqqqq"})

        assert response.status_code == HTTPStatus.OK
        assert _body(response) == []

    def test_rejects_a_query_too_short_to_search(
        self,
        auth_client: APIClient,
    ) -> None:
        """Two characters match half the city; the client waits for more."""
        response = auth_client.get(GEOCODE_URL, {"q": "Ka"})

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_requires_a_query(self, auth_client: APIClient) -> None:
        """`q` is what there is to search for."""
        response = auth_client.get(GEOCODE_URL)

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_rejects_a_limit_beyond_the_maximum(
        self,
        auth_client: APIClient,
    ) -> None:
        """The proxy decides how much of the upstream service it will use."""
        response = auth_client.get(GEOCODE_URL, {"q": "Kalvarijų", "limit": 50})

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_passes_the_requested_limit_to_the_geocoder(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A client asking for three suggestions gets three looked up."""
        seen: dict[str, object] = {}

        def _record(query: str, limit: int) -> tuple[Place, ...]:
            seen["query"] = query
            seen["limit"] = limit
            return (_PLACE,)

        monkeypatch.setattr(geocoding_services, "search", _record)

        response = auth_client.get(GEOCODE_URL, {"q": "Kalvarijų 98", "limit": 3})

        assert response.status_code == HTTPStatus.OK
        assert seen == {"query": "Kalvarijų 98", "limit": 3}

    def test_an_unavailable_geocoder_is_not_a_server_error(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """503 tells the app to fall back to placing the pin by hand."""

        def _broken(query: str, limit: int) -> tuple[Place, ...]:
            del query, limit
            msg = "The geocoder did not answer."
            raise GeocoderError(msg)

        monkeypatch.setattr(geocoding_services, "search", _broken)

        response = auth_client.get(GEOCODE_URL, {"q": "Kalvarijų 98"})

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
