"""Tests for `GET /api/leaderboard`."""

from http import HTTPStatus
from typing import cast

import pytest
from districts.models import District
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User

LEADERBOARD_URL = "/api/leaderboard"
HIGH, LOW = 50, 20
SECOND = 2


def _body(response: Response) -> dict[str, object]:
    """Return the response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


def _names(response: Response) -> list[str]:
    """Return the leaderboard's names, in order."""
    entries = cast("list[dict[str, dict[str, str]]]", _body(response)["entries"])
    return [entry["user"]["name"] for entry in entries]


def _with_points(user: User, points: int, district: District | None = None) -> User:
    """Give `user` some points (and a district)."""
    user.points = points
    user.district = district
    user.save(update_fields=["points", "district"])
    return user


@pytest.mark.django_db
class TestLeaderboard:
    """Tests for `GET /api/leaderboard`."""

    def test_ranks_residents_with_points_best_first(
        self,
        api_client: APIClient,
        user: User,
        other_user: User,
        staff_user: User,
    ) -> None:
        """Most points first; residents with none aren't listed."""
        _ = _with_points(user, LOW)
        _ = _with_points(other_user, HIGH)
        del staff_user

        response = api_client.get(LEADERBOARD_URL)

        assert response.status_code == HTTPStatus.OK
        assert _names(response) == ["Other Citizen", "Citizen"]

    def test_filters_by_the_district_residents_chose(
        self,
        api_client: APIClient,
        user: User,
        other_user: User,
        district: District,
    ) -> None:
        """With `district`, only residents who chose it are ranked."""
        _ = _with_points(user, LOW, district)
        _ = _with_points(other_user, HIGH)

        response = api_client.get(LEADERBOARD_URL, {"district": str(district.id)})

        assert _names(response) == ["Citizen"]

    def test_tells_you_where_you_stand(
        self,
        auth_client: APIClient,
        user: User,
        other_user: User,
    ) -> None:
        """Your own row comes back even when it's outside the top."""
        _ = _with_points(user, LOW)
        _ = _with_points(other_user, HIGH)

        response = auth_client.get(LEADERBOARD_URL, {"limit": 1})

        me = cast("dict[str, object]", _body(response)["me"])
        assert _names(response) == ["Other Citizen"]
        assert me["rank"] == SECOND
        assert me["points"] == LOW

    def test_without_points_you_are_not_ranked(
        self,
        auth_client: APIClient,
        user: User,
    ) -> None:
        """Someone with no points has no row of their own yet."""
        del user

        assert _body(auth_client.get(LEADERBOARD_URL))["me"] is None
