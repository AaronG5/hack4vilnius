"""Tests for the notification endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from notifications.constants import EVENT_STATUS_CHANGED
from notifications.models import Notification
from problems.models import Problem
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User

NOTIFICATIONS_URL = "/api/notifications"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


def _notify(user: User, problem: Problem | None = None) -> Notification:
    """Create a status-change notification for `user`."""
    return Notification.objects.create(
        user=user,
        message="A problem you're involved with is now Ongoing.",
        event_type=EVENT_STATUS_CHANGED,
        problem=problem,
    )


@pytest.mark.django_db
class TestNotificationList:
    """Tests for `GET /api/notifications`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """Notifications are per-user, so a token is required."""
        response = api_client.get(NOTIFICATIONS_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_the_contract_fields(
        self,
        auth_client: APIClient,
        user: User,
        problem: Problem,
    ) -> None:
        """A notification carries its message, event type, read flag and problem."""
        notification = _notify(user, problem)

        response = auth_client.get(NOTIFICATIONS_URL)

        assert response.status_code == HTTPStatus.OK
        entry = _entries(response)[0]
        assert entry["id"] == str(notification.id)
        assert entry["event_type"] == EVENT_STATUS_CHANGED
        assert entry["read"] is False
        assert entry["problem"] == str(problem.id)

    def test_problem_is_null_when_unrelated(
        self,
        auth_client: APIClient,
        user: User,
    ) -> None:
        """A notification not tied to a problem serializes it as `null`."""
        _ = _notify(user)

        response = auth_client.get(NOTIFICATIONS_URL)

        assert _entries(response)[0]["problem"] is None

    def test_does_not_leak_other_users_notifications(
        self,
        auth_client: APIClient,
        other_user: User,
    ) -> None:
        """Need-to-know basis: only the requester's own notifications are listed."""
        _ = _notify(other_user)

        response = auth_client.get(NOTIFICATIONS_URL)

        assert _entries(response) == []


@pytest.mark.django_db
class TestNotificationMarkRead:
    """Tests for `PUT /api/notifications/{id}/read`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        user: User,
    ) -> None:
        """Marking a notification read without a token is rejected."""
        notification = _notify(user)

        response = api_client.put(f"{NOTIFICATIONS_URL}/{notification.id}/read")

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_marks_it_as_read(self, auth_client: APIClient, user: User) -> None:
        """The updated notification comes back with `read` set."""
        notification = _notify(user)

        response = auth_client.put(f"{NOTIFICATIONS_URL}/{notification.id}/read")

        assert response.status_code == HTTPStatus.OK
        assert _body(response)["read"] is True
        notification.refresh_from_db()
        assert notification.read is True

    def test_is_idempotent(self, auth_client: APIClient, user: User) -> None:
        """Marking an already-read notification read again is harmless."""
        notification = _notify(user)
        _ = auth_client.put(f"{NOTIFICATIONS_URL}/{notification.id}/read")

        response = auth_client.put(f"{NOTIFICATIONS_URL}/{notification.id}/read")

        assert response.status_code == HTTPStatus.OK
        assert _body(response)["read"] is True

    def test_cannot_touch_another_users_notification(
        self,
        auth_client: APIClient,
        other_user: User,
    ) -> None:
        """Another user's notification 404s rather than revealing it exists."""
        notification = _notify(other_user)

        response = auth_client.put(f"{NOTIFICATIONS_URL}/{notification.id}/read")

        assert response.status_code == HTTPStatus.NOT_FOUND
        notification.refresh_from_db()
        assert notification.read is False

    def test_unknown_id_is_not_found(self, auth_client: APIClient) -> None:
        """A notification id that doesn't exist is a 404."""
        response = auth_client.put(f"{NOTIFICATIONS_URL}/{uuid4()}/read")

        assert response.status_code == HTTPStatus.NOT_FOUND
