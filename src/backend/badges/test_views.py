"""Tests for GET /api/badges and GET /api/users/me/badges."""

from http import HTTPStatus
from typing import cast

import pytest
from badges.models import Badge, UserBadge
from districts.models import District
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User

BADGES_URL = "/api/badges"
MY_BADGES_URL = "/api/users/me/badges"
REQUIRED_VALIDATIONS = 10


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


@pytest.mark.django_db
class TestBadgeList:
    """Tests for `GET /api/badges`."""

    def test_is_public(self, api_client: APIClient, badge: Badge) -> None:
        """The badge catalogue is readable without a token."""
        del badge
        response = api_client.get(BADGES_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        badge: Badge,
        district: District,
    ) -> None:
        """A badge carries its criteria, validation count and nested district."""
        response = api_client.get(BADGES_URL)

        entry = _entries(response)[0]
        assert entry["id"] == str(badge.id)
        assert entry["name"] == "Senamiestis Scout"
        assert entry["criteria"] == "Validate 10 problems in Senamiestis."
        assert entry["required_validation_count"] == REQUIRED_VALIDATIONS
        nested = cast("dict[str, object]", entry["district"])
        assert nested["id"] == str(district.id)

    def test_district_agnostic_badge_has_a_null_district(
        self,
        api_client: APIClient,
    ) -> None:
        """A badge not scoped to a district serializes `district` as `null`."""
        _ = Badge.objects.create(
            name="First Report",
            description="File your first report.",
            icon="https://example.com/icons/first.svg",
            criteria="File one report.",
        )

        response = api_client.get(BADGES_URL)

        entry = _entries(response)[0]
        assert entry["district"] is None
        assert entry["required_validation_count"] is None


@pytest.mark.django_db
class TestMyBadges:
    """Tests for `GET /api/users/me/badges`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """Earned badges are per-user, so a token is required."""
        response = api_client.get(MY_BADGES_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_earned_badges_with_timestamps(
        self,
        auth_client: APIClient,
        user: User,
        badge: Badge,
    ) -> None:
        """Each entry nests the badge and says when it was earned."""
        _ = UserBadge.objects.create(user=user, badge=badge)

        response = auth_client.get(MY_BADGES_URL)

        assert response.status_code == HTTPStatus.OK
        entry = _entries(response)[0]
        nested = cast("dict[str, object]", entry["badge"])
        assert nested["id"] == str(badge.id)
        assert entry["earned_at"] is not None

    def test_is_empty_before_earning_anything(
        self,
        auth_client: APIClient,
        badge: Badge,
    ) -> None:
        """An existing badge nobody has earned isn't reported as earned."""
        del badge
        response = auth_client.get(MY_BADGES_URL)

        assert _entries(response) == []

    def test_does_not_leak_other_users_badges(
        self,
        auth_client: APIClient,
        other_user: User,
        badge: Badge,
    ) -> None:
        """Need-to-know basis: only the requester's own awards are listed."""
        _ = UserBadge.objects.create(user=other_user, badge=badge)

        response = auth_client.get(MY_BADGES_URL)

        assert _entries(response) == []
