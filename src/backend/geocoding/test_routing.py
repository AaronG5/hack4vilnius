"""Tests for walking routes (`geocoding.routing` and `GET /api/routes/walk`)."""

from collections.abc import Iterator, Mapping
from http import HTTPStatus
from typing import cast

import pytest
from geocoding import routing
from rest_framework.response import Response
from rest_framework.test import APIClient

WALK_URL = "/api/routes/walk"
TWO_STOPS = "25.2797,54.6872;25.2870,54.6890"
ROUTE_METRES = 854
ROUTE_SECONDS = 610

_OSRM_ANSWER: dict[str, object] = {
    "code": "Ok",
    "routes": [
        {
            "distance": 854.4,
            "duration": 610.2,
            "geometry": {
                "type": "LineString",
                "coordinates": [[25.2797, 54.6872], [25.283, 54.688], [25.287, 54.689]],
            },
            "legs": [{"distance": 854.4, "duration": 610.2}],
        },
    ],
}


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    """Keep each test's stubbed answers out of the next test's cache."""
    routing.walking_route.cache_clear()
    yield
    routing.walking_route.cache_clear()


def _stub(monkeypatch: pytest.MonkeyPatch, answer: Mapping[str, object]) -> None:
    """Answer the router call with `answer`, without touching the network."""

    def _fake(stops: str) -> Mapping[str, object]:
        del stops
        return answer

    monkeypatch.setattr(routing, "_request_route", _fake)


def _fail(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the router unreachable."""

    def _fake(stops: str) -> Mapping[str, object]:
        del stops
        msg = "down"
        raise routing.RoutingError(msg)

    monkeypatch.setattr(routing, "_request_route", _fake)


def _body(response: Response) -> dict[str, object]:
    """Return the response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


class TestWalkingRoute:
    """Tests for `routing.walking_route`."""

    def test_reads_length_time_path_and_legs(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The router's answer becomes a typed route."""
        _stub(monkeypatch, _OSRM_ANSWER)

        route = routing.walking_route(((25.2797, 54.6872), (25.287, 54.689)))

        assert round(route.distance_m) == ROUTE_METRES
        assert route.path[0] == (25.2797, 54.6872)
        assert len(route.legs) == 1

    def test_no_path_is_an_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """An answer without a route is reported, not returned empty."""
        _stub(monkeypatch, {"code": "NoRoute", "routes": []})

        with pytest.raises(routing.RoutingError):
            _ = routing.walking_route(((25.2797, 54.6872), (25.287, 54.689)))


@pytest.mark.django_db
class TestWalkingRouteView:
    """Tests for `GET /api/routes/walk`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """It spends an external service's quota, so only app users may call it."""
        response = api_client.get(WALK_URL, {"stops": TWO_STOPS})

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_the_walk(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Length and time in whole metres and seconds, with a GeoJSON path."""
        _stub(monkeypatch, _OSRM_ANSWER)

        response = auth_client.get(WALK_URL, {"stops": TWO_STOPS})

        body = _body(response)
        path = cast("dict[str, object]", body["path"])
        assert response.status_code == HTTPStatus.OK
        assert body["distance_m"] == ROUTE_METRES
        assert body["duration_s"] == ROUTE_SECONDS
        assert path["type"] == "LineString"

    def test_rejects_malformed_stops(self, auth_client: APIClient) -> None:
        """Stops must be "lng,lat" pairs, at least two."""
        for stops in ("25.27,54.68", "nonsense", "25.27,54.68;999,54.69"):
            response = auth_client.get(WALK_URL, {"stops": stops})
            assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_says_when_the_router_is_down(
        self,
        auth_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The app then draws straight lines instead."""
        _fail(monkeypatch)

        response = auth_client.get(WALK_URL, {"stops": TWO_STOPS})

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
