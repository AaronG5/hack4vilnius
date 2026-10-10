"""Tests for the challenge endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from categories.models import Category
from challenges.models import Challenge
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from vilnius_backend.choices import ChallengeStatus

CHALLENGES_URL = "/api/challenges"
REWARD_POINTS = 500


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


@pytest.mark.django_db
class TestChallengeList:
    """Tests for `GET /api/challenges`."""

    def test_is_public(self, api_client: APIClient, challenge: Challenge) -> None:
        """The challenge list is readable without a token."""
        del challenge
        response = api_client.get(CHALLENGES_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        challenge: Challenge,
        category: Category,
    ) -> None:
        """A challenge carries its dates, reward, status and target categories."""
        response = api_client.get(CHALLENGES_URL)

        entry = _entries(response)[0]
        assert entry["id"] == str(challenge.id)
        assert entry["name"] == "Spring Clean-up"
        assert entry["start_date"] == "2026-03-01"
        assert entry["end_date"] == "2026-04-01"
        assert entry["reward_points"] == REWARD_POINTS
        assert entry["status"] == ChallengeStatus.UPCOMING
        categories = cast("list[dict[str, object]]", entry["categories"])
        assert categories[0]["id"] == str(category.id)

    def test_says_how_many_joined_and_whether_you_did(
        self,
        auth_client: APIClient,
        challenge: Challenge,
        user: User,
    ) -> None:
        """Each entry carries its participant count and the caller's own status."""
        challenge.participants.add(user)

        entry = _entries(auth_client.get(CHALLENGES_URL))[0]

        assert entry["participant_count"] == 1
        assert entry["joined"] is True

    def test_anonymous_callers_have_joined_nothing(
        self,
        api_client: APIClient,
        challenge: Challenge,
    ) -> None:
        """Without a session, `joined` is always false."""
        del challenge

        assert _entries(api_client.get(CHALLENGES_URL))[0]["joined"] is False


@pytest.mark.django_db
class TestChallengeDetail:
    """Tests for `GET /api/challenges/{id}`."""

    def test_includes_participant_count_and_milestones(
        self,
        api_client: APIClient,
        challenge: Challenge,
        user: User,
    ) -> None:
        """The detail view adds the participant count and milestone list."""
        challenge.participants.add(user)

        response = api_client.get(f"{CHALLENGES_URL}/{challenge.id}")

        assert response.status_code == HTTPStatus.OK
        body = _body(response)
        assert body["participant_count"] == 1
        assert body["milestones"] == []

    def test_unknown_id_is_not_found(self, api_client: APIClient) -> None:
        """A challenge id that doesn't exist is a 404."""
        response = api_client.get(f"{CHALLENGES_URL}/{uuid4()}")

        assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.django_db
class TestChallengeJoin:
    """Tests for `POST /api/challenges/{id}/join`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        challenge: Challenge,
    ) -> None:
        """Joining without a token is rejected."""
        response = api_client.post(f"{CHALLENGES_URL}/{challenge.id}/join")

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_adds_the_user_as_a_participant(
        self,
        auth_client: APIClient,
        challenge: Challenge,
        user: User,
    ) -> None:
        """Joining returns 204 and records the participation."""
        response = auth_client.post(f"{CHALLENGES_URL}/{challenge.id}/join")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert challenge.participants.filter(pk=user.pk).exists()

    def test_joining_twice_is_idempotent(
        self,
        auth_client: APIClient,
        challenge: Challenge,
    ) -> None:
        """A double join doesn't duplicate the participation."""
        _ = auth_client.post(f"{CHALLENGES_URL}/{challenge.id}/join")
        response = auth_client.post(f"{CHALLENGES_URL}/{challenge.id}/join")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert challenge.participants.count() == 1

    def test_leaving_removes_the_participation(
        self,
        auth_client: APIClient,
        challenge: Challenge,
    ) -> None:
        """`DELETE` on the join URL leaves the challenge."""
        _ = auth_client.post(f"{CHALLENGES_URL}/{challenge.id}/join")
        response = auth_client.delete(f"{CHALLENGES_URL}/{challenge.id}/join")

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert challenge.participants.count() == 0

    def test_unknown_challenge_is_not_found(self, auth_client: APIClient) -> None:
        """Joining a challenge that doesn't exist is a 404, not a 500."""
        response = auth_client.post(f"{CHALLENGES_URL}/{uuid4()}/join")

        assert response.status_code == HTTPStatus.NOT_FOUND
