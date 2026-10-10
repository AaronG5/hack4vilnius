"""Tests for the moderation endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from moderation.models import ModerationFlag
from reports.models import Report
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from vilnius_backend.choices import ModerationFlagStatus

FLAGS_URL = "/api/moderation/flags"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


@pytest.mark.django_db
class TestModerationFlagList:
    """Tests for `GET /api/moderation/flags`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """The moderation queue is not public."""
        response = api_client.get(FLAGS_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_rejects_regular_users(self, auth_client: APIClient) -> None:
        """A citizen can't read the moderation queue."""
        response = auth_client.get(FLAGS_URL)

        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_staff_see_pending_flags(
        self,
        staff_client: APIClient,
        moderation_flag: ModerationFlag,
        report: Report,
    ) -> None:
        """A pending flag is listed with its reason and report."""
        response = staff_client.get(FLAGS_URL)

        assert response.status_code == HTTPStatus.OK
        entry = _entries(response)[0]
        assert entry["id"] == str(moderation_flag.id)
        assert entry["status"] == ModerationFlagStatus.PENDING
        assert entry["report"] == str(report.id)
        assert entry["reviewed_by"] is None
        assert entry["reviewed_at"] is None

    def test_city_administrators_see_pending_flags(
        self,
        admin_client: APIClient,
        moderation_flag: ModerationFlag,
    ) -> None:
        """City administrators share the staff view of the queue."""
        del moderation_flag
        response = admin_client.get(FLAGS_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_excludes_already_reviewed_flags(
        self,
        staff_client: APIClient,
        moderation_flag: ModerationFlag,
    ) -> None:
        """The queue is for pending review, so resolved flags drop out."""
        moderation_flag.status = ModerationFlagStatus.DISMISSED
        moderation_flag.save(update_fields=["status"])

        response = staff_client.get(FLAGS_URL)

        assert _entries(response) == []


@pytest.mark.django_db
class TestModerationFlagUpdate:
    """Tests for `PUT /api/moderation/flags/{id}`."""

    def test_rejects_regular_users(
        self,
        auth_client: APIClient,
        moderation_flag: ModerationFlag,
    ) -> None:
        """A citizen can't resolve their own flag."""
        response = auth_client.put(
            f"{FLAGS_URL}/{moderation_flag.id}",
            {"status": ModerationFlagStatus.DISMISSED},
            format="json",
        )

        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_confirming_records_the_reviewer(
        self,
        staff_client: APIClient,
        staff_user: User,
        moderation_flag: ModerationFlag,
    ) -> None:
        """Confirming a flag stores who reviewed it and when."""
        response = staff_client.put(
            f"{FLAGS_URL}/{moderation_flag.id}",
            {"status": ModerationFlagStatus.CONFIRMED_HARMFUL},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        body = _body(response)
        assert body["status"] == ModerationFlagStatus.CONFIRMED_HARMFUL
        reviewer = cast("dict[str, object]", body["reviewed_by"])
        assert reviewer["id"] == staff_user.pk
        assert body["reviewed_at"] is not None
        moderation_flag.refresh_from_db()
        assert moderation_flag.reviewed_by == staff_user

    def test_dismissing_resolves_the_flag(
        self,
        staff_client: APIClient,
        moderation_flag: ModerationFlag,
    ) -> None:
        """Dismissing marks the flag resolved without harming the reporter."""
        response = staff_client.put(
            f"{FLAGS_URL}/{moderation_flag.id}",
            {"status": ModerationFlagStatus.DISMISSED},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        moderation_flag.refresh_from_db()
        assert moderation_flag.status == ModerationFlagStatus.DISMISSED

    def test_leaves_the_trust_score_alone_while_stubbed(
        self,
        staff_client: APIClient,
        moderation_flag: ModerationFlag,
        user: User,
    ) -> None:
        """Trust rating is deferred, so confirming a flag doesn't change the score."""
        before = user.trust_score

        _ = staff_client.put(
            f"{FLAGS_URL}/{moderation_flag.id}",
            {"status": ModerationFlagStatus.CONFIRMED_HARMFUL},
            format="json",
        )

        user.refresh_from_db()
        assert user.trust_score == before

    def test_rejects_setting_it_back_to_pending(
        self,
        staff_client: APIClient,
        moderation_flag: ModerationFlag,
    ) -> None:
        """A review decision is either confirmed harmful or dismissed."""
        response = staff_client.put(
            f"{FLAGS_URL}/{moderation_flag.id}",
            {"status": ModerationFlagStatus.PENDING},
            format="json",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_unknown_id_is_not_found(self, staff_client: APIClient) -> None:
        """Resolving a flag that doesn't exist is a 404."""
        response = staff_client.put(
            f"{FLAGS_URL}/{uuid4()}",
            {"status": ModerationFlagStatus.DISMISSED},
            format="json",
        )

        assert response.status_code == HTTPStatus.NOT_FOUND
