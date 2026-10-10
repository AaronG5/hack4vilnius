"""Tests for the report endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from categories.models import Category
from django.core.files.uploadedfile import SimpleUploadedFile
from moderation.models import ModerationFlag
from problems.models import Problem
from reports.models import Report
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from vilnius_backend.choices import MediaType, ProblemStatus, ProblemUrgency

REPORTS_URL = "/api/reports"
NEUTRAL_SCORE = 50.0
UPLOAD_COUNT = 2


def _body(response: Response) -> dict[str, object]:
    """Return a response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


def _photo(name: str = "photo.jpg") -> SimpleUploadedFile:
    """Return a small in-memory JPEG upload."""
    return SimpleUploadedFile(name, b"fake-jpeg-bytes", content_type="image/jpeg")


@pytest.mark.django_db
class TestReportCreate:
    """Tests for `POST /api/reports`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        category: Category,
    ) -> None:
        """Reporting without a token is rejected."""
        response = api_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_creates_a_new_problem_for_a_fresh_report(
        self,
        auth_client: APIClient,
        category: Category,
        user: User,
    ) -> None:
        """Omitting `problem` creates an unconfirmed problem at the coordinates."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "A large pothole on the corner.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        report = Report.objects.get()
        assert report.user == user
        assert report.description == "A large pothole on the corner."
        problem = Problem.objects.get()
        assert problem.status == ProblemStatus.UNCONFIRMED
        assert problem.category == category
        assert problem.location == {
            "type": "Point",
            "coordinates": [25.28, 54.69],
        }

    def test_new_problem_gets_the_stubbed_score_and_urgency(
        self,
        auth_client: APIClient,
        category: Category,
    ) -> None:
        """Scoring is stubbed: a neutral score and the category's default urgency."""
        _ = auth_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        problem = Problem.objects.get()
        assert problem.legitimacy_score == NEUTRAL_SCORE
        assert problem.urgency == ProblemUrgency.URGENT

    def test_attaches_uploaded_media_to_the_report(
        self,
        auth_client: APIClient,
        category: Category,
        user: User,
    ) -> None:
        """Each uploaded file becomes a `Media` row attached to the report."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo("one.jpg"), _photo("two.jpg")],
            },
            format="multipart",
        )

        report = Report.objects.get()
        assert report.media.count() == UPLOAD_COUNT
        media = report.media.all()[0]
        assert media.type == MediaType.PHOTO
        assert media.uploaded_by == user
        body = cast("list[dict[str, object]]", _body(response)["media"])
        assert len(body) == UPLOAD_COUNT
        assert cast("str", body[0]["file_url"]).startswith("http")

    def test_attaches_to_an_existing_problem_when_given(
        self,
        auth_client: APIClient,
        problem: Problem,
        category: Category,
    ) -> None:
        """Confirming a duplicate attaches the report instead of creating a problem."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "Same pothole, still here.",
                "category": str(category.id),
                "problem": str(problem.id),
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert Problem.objects.count() == 1
        assert Report.objects.get().problem == problem

    def test_falls_back_to_the_other_category_without_one(
        self,
        auth_client: APIClient,
    ) -> None:
        """Without a category or AI suggestion, use the one named Other."""
        other = Category.objects.create(
            name="Other",
            description="Anything else.",
            icon="https://example.com/icons/other.svg",
            default_urgency=ProblemUrgency.CAN_WAIT,
        )

        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "Something odd.",
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert Problem.objects.get().category == other

    def test_uses_the_top_ai_suggestion_without_a_category(
        self,
        auth_client: APIClient,
        category: Category,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The AI's first pick files the problem and is recorded on the report."""
        _ = Category.objects.create(
            name="Other",
            description="Anything else.",
            icon="https://example.com/icons/other.svg",
            default_urgency=ProblemUrgency.CAN_WAIT,
        )
        calls: list[str] = []

        def _suggest(description: str) -> list[Category]:
            calls.append(description)
            return [category]

        monkeypatch.setattr("reports.views.report_services.suggest_category", _suggest)

        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "Duobe kelyje.",
                "latitude": 54.69,
                "longitude": 25.28,
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert Problem.objects.get().category == category
        assert _body(response)["ai_category_suggestion"] == category.name
        assert calls == ["Duobe kelyje."]

    def test_requires_coordinates_for_a_new_problem(
        self,
        auth_client: APIClient,
        category: Category,
    ) -> None:
        """Without `problem`, coordinates are needed to place the new problem."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_allows_a_text_only_report(
        self,
        auth_client: APIClient,
        category: Category,
    ) -> None:
        """Media is optional: the app lets a resident describe a problem in words."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["media"] == []
        assert Report.objects.get().media.count() == 0

    def test_requires_a_description(
        self,
        auth_client: APIClient,
        category: Category,
    ) -> None:
        """A photo with no comment is rejected, per the UX requirement."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_is_not_flagged_for_abuse_while_stubbed(
        self,
        auth_client: APIClient,
        category: Category,
    ) -> None:
        """Abuse detection is stubbed, so nothing is flagged yet."""
        response = auth_client.post(
            REPORTS_URL,
            {
                "description": "A pothole.",
                "category": str(category.id),
                "latitude": 54.69,
                "longitude": 25.28,
                "media": [_photo()],
            },
            format="multipart",
        )

        body = _body(response)
        assert body["ai_abuse_flag"] is False
        assert body["has_moderation_flag"] is False
        assert body["ai_category_suggestion"] is None


@pytest.mark.django_db
class TestReportDetail:
    """Tests for `GET /api/reports/{id}`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        report: Report,
    ) -> None:
        """Report details are not public, unlike problem details."""
        response = api_client.get(f"{REPORTS_URL}/{report.id}")

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_the_reporter_can_read_their_own_report(
        self,
        auth_client: APIClient,
        report: Report,
    ) -> None:
        """The user who filed the report can read it back."""
        response = auth_client.get(f"{REPORTS_URL}/{report.id}")

        assert response.status_code == HTTPStatus.OK
        assert _body(response)["id"] == str(report.id)

    def test_other_users_cannot_see_it(
        self,
        other_auth_client: APIClient,
        report: Report,
    ) -> None:
        """Need-to-know basis: another citizen gets a 404, not a 403."""
        response = other_auth_client.get(f"{REPORTS_URL}/{report.id}")

        assert response.status_code == HTTPStatus.NOT_FOUND

    def test_staff_can_read_any_report(
        self,
        staff_client: APIClient,
        report: Report,
    ) -> None:
        """Staff need every report to moderate, so they can read them all."""
        response = staff_client.get(f"{REPORTS_URL}/{report.id}")

        assert response.status_code == HTTPStatus.OK

    def test_reports_its_moderation_flag(
        self,
        auth_client: APIClient,
        report: Report,
        moderation_flag: ModerationFlag,
    ) -> None:
        """A flagged report says so, without exposing the flag itself."""
        del moderation_flag
        response = auth_client.get(f"{REPORTS_URL}/{report.id}")

        assert _body(response)["has_moderation_flag"] is True

    def test_unknown_id_is_not_found(self, auth_client: APIClient) -> None:
        """A report id that doesn't exist is a 404."""
        response = auth_client.get(f"{REPORTS_URL}/{uuid4()}")

        assert response.status_code == HTTPStatus.NOT_FOUND
