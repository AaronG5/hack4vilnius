"""Tests for the validation endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from problems.models import Problem
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from validations.models import Validation

PROBLEMS_URL = "/api/problems"
FLAT_AWARD = 10


def _url(problem: Problem) -> str:
    """Return the validations URL for `problem`."""
    return f"{PROBLEMS_URL}/{problem.id}/validations"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


def _photo() -> SimpleUploadedFile:
    """Return a small in-memory JPEG upload."""
    return SimpleUploadedFile(
        "photo.jpg", b"fake-jpeg-bytes", content_type="image/jpeg"
    )


@pytest.mark.django_db
class TestValidationList:
    """Tests for `GET /api/problems/{id}/validations`."""

    def test_is_public(
        self,
        api_client: APIClient,
        problem: Problem,
        validation: Validation,
    ) -> None:
        """Validations are readable without a token, like problem details."""
        response = api_client.get(_url(problem))

        assert response.status_code == HTTPStatus.OK
        assert [entry["id"] for entry in _entries(response)] == [str(validation.id)]

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        problem: Problem,
        validation: Validation,
    ) -> None:
        """A validation carries its verdict, description and awarded points."""
        response = api_client.get(_url(problem))

        entry = _entries(response)[0]
        assert entry["is_valid"] is True
        assert entry["description"] == validation.description
        assert entry["points_awarded"] == FLAT_AWARD
        assert entry["problem"] == str(problem.id)

    def test_only_lists_the_named_problems_validations(
        self,
        api_client: APIClient,
        problem: Problem,
        validation: Validation,
        category: object,
    ) -> None:
        """Validations of a different problem are not included."""
        del validation, category
        other = Problem.objects.create(
            status=problem.status,
            urgency=problem.urgency,
            legitimacy_score=50.0,
            location=problem.location,
            category=problem.category,
        )

        response = api_client.get(_url(other))

        assert _entries(response) == []

    def test_unknown_problem_is_not_found(self, api_client: APIClient) -> None:
        """Listing validations of a missing problem is a 404."""
        response = api_client.get(f"{PROBLEMS_URL}/{uuid4()}/validations")

        assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.django_db
class TestValidationCreate:
    """Tests for `POST /api/problems/{id}/validations`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        problem: Problem,
    ) -> None:
        """Submitting a validation without a token is rejected."""
        response = api_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_creates_a_validation_for_the_problem(
        self,
        auth_client: APIClient,
        problem: Problem,
        user: User,
    ) -> None:
        """A validation is recorded against the URL's problem and the caller."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        validation = Validation.objects.get()
        assert validation.problem == problem
        assert validation.user == user
        assert validation.is_valid is True

    def test_awards_the_stubbed_point_amount(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Point calculation is stubbed to a flat amount for now."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert _body(response)["points_awarded"] == FLAT_AWARD
        assert Validation.objects.get().points_awarded == FLAT_AWARD

    def test_attaches_uploaded_media(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Media proves the validator physically visited the place."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert Validation.objects.get().media.count() == 1
        assert len(cast("list[object]", _body(response)["media"])) == 1

    def test_can_dispute_a_problem(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """A validation can also say the problem isn't real."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": False, "description": "Road looks fine.", "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert Validation.objects.get().is_valid is False

    def test_leaves_the_problem_status_alone_while_stubbed(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Confirm/cancel transitions are deferred, so the status doesn't move."""
        _ = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        previous_status = problem.status
        problem.refresh_from_db()
        assert problem.status == previous_status

    def test_allows_an_answer_without_media(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Media is optional: answering "still there" / "fixed" is a single tap."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here."},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["media"] == []
        assert Validation.objects.get().media.count() == 0

    def test_requires_a_description(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """A validation needs a text description, with or without media."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_unknown_problem_is_not_found(self, auth_client: APIClient) -> None:
        """Validating a problem that doesn't exist is a 404, not a 500."""
        response = auth_client.post(
            f"{PROBLEMS_URL}/{uuid4()}/validations",
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.NOT_FOUND
