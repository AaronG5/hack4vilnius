"""Tests for the validation endpoints."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from notifications.models import Notification
from problems.lifecycle import ANSWER_POINTS
from problems.models import Problem
from reports.models import Report
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import MediaType, ProblemStatus, ProblemUrgency

PROBLEMS_URL = "/api/problems"
MEDIA_COUNT = 3
TWO_ANSWERS = 2


def _url(problem: Problem) -> str:
    """Return the validations URL for `problem`."""
    return f"{PROBLEMS_URL}/{problem.id}/validations"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


def _photo(name: str = "photo.jpg") -> SimpleUploadedFile:
    """Return a small in-memory JPEG upload."""
    return SimpleUploadedFile(name, b"fake-jpeg-bytes", content_type="image/jpeg")


def _video(name: str = "clip.mp4") -> SimpleUploadedFile:
    """Return a small in-memory video upload."""
    return SimpleUploadedFile(name, b"fake-mp4-bytes", content_type="video/mp4")


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
        assert entry["points_awarded"] == validation.points_awarded
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

    def test_an_answer_earns_nothing_until_it_proves_right(
        self,
        auth_client: APIClient,
        problem: Problem,
        user: User,
    ) -> None:
        """A lone answer decides nothing, so it isn't paid yet."""
        before = user.points
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        user.refresh_from_db()
        assert _body(response)["points_awarded"] == 0
        assert user.points == before

    def test_the_answer_that_confirms_is_paid(
        self,
        auth_client: APIClient,
        other_auth_client: APIClient,
        problem: Problem,
        other_user: User,
    ) -> None:
        """The answer that tips the problem into confirmed is paid at once."""
        _ = auth_client.post(_url(problem), {"is_valid": True}, format="multipart")
        response = other_auth_client.post(
            _url(problem),
            {"is_valid": True},
            format="multipart",
        )

        other_user.refresh_from_db()
        assert _body(response)["points_awarded"] == ANSWER_POINTS
        assert other_user.points == ANSWER_POINTS

    def test_a_refused_second_answer_changes_nothing(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Answering the same problem twice is refused."""
        body: dict[str, object] = {"is_valid": True, "media": []}
        _ = auth_client.post(_url(problem), body, format="multipart")
        response = auth_client.post(_url(problem), body, format="multipart")

        assert response.status_code == HTTPStatus.CONFLICT
        assert Validation.objects.count() == 1

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

    def test_one_answer_decides_nothing(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """A single passer-by can neither confirm nor erase a problem."""
        problem.status = ProblemStatus.UNCONFIRMED
        problem.save(update_fields=["status"])

        _ = auth_client.post(
            _url(problem),
            {"is_valid": True, "media": [_photo()]},
            format="multipart",
        )

        problem.refresh_from_db()
        assert problem.status == ProblemStatus.UNCONFIRMED

    def test_two_agreeing_answers_confirm_the_problem(
        self,
        auth_client: APIClient,
        other_auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Two residents saying the problem is there confirm it."""
        problem.status = ProblemStatus.UNCONFIRMED
        problem.save(update_fields=["status"])

        for client in (auth_client, other_auth_client):
            _ = client.post(_url(problem), {"is_valid": True}, format="multipart")

        problem.refresh_from_db()
        assert problem.status == ProblemStatus.CONFIRMED

    def test_confirming_tells_the_people_involved(
        self,
        other_auth_client: APIClient,
        staff_client: APIClient,
        problem: Problem,
        report: Report,
    ) -> None:
        """When two neighbours confirm a problem, its reporter is paid and told why."""
        problem.status = ProblemStatus.UNCONFIRMED
        problem.save(update_fields=["status"])

        # Two people besides the reporter (the `report` fixture's author).
        for client in (other_auth_client, staff_client):
            _ = client.post(_url(problem), {"is_valid": True}, format="multipart")

        messages: list[str] = list(
            Notification.objects.filter(user=report.user).values_list(
                "message",
                flat=True,
            ),
        )
        assert any(m.startswith("Gavote 20 tšk.! Kaimynai") for m in messages)

    def test_one_answer_notifies_nobody(
        self,
        auth_client: APIClient,
        problem: Problem,
        report: Report,
    ) -> None:
        """An answer that decides nothing sends nothing."""
        del report
        problem.status = ProblemStatus.UNCONFIRMED
        problem.save(update_fields=["status"])

        _ = auth_client.post(_url(problem), {"is_valid": True}, format="multipart")

        assert not Notification.objects.exists()

    def test_saying_it_is_gone_marks_it_fixed(
        self,
        auth_client: APIClient,
        problem: Problem,
        user: User,
    ) -> None:
        """One "there is no problem" opens the hour for neighbours to confirm."""
        _ = auth_client.post(_url(problem), {"is_valid": False}, format="multipart")

        problem.refresh_from_db()
        assert problem.status == ProblemStatus.COMPLETED
        assert problem.fixed_at is not None
        assert problem.fix_claimed_by == user

    def test_a_problem_the_city_is_working_on_is_left_alone(
        self,
        auth_client: APIClient,
        other_auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Once a case worker owns the status, answers stop moving it."""
        problem.status = ProblemStatus.ONGOING
        problem.save(update_fields=["status"])

        for client in (auth_client, other_auth_client):
            _ = client.post(_url(problem), {"is_valid": False}, format="multipart")

        problem.refresh_from_db()
        assert problem.status == ProblemStatus.ONGOING

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

    def test_allows_an_answer_with_no_extra_text(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """The answer is `is_valid`; the text beside it is optional."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["description"] == ""

    def test_keeps_a_longer_account_than_the_report_gave(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """A resident can say more than the original report did."""
        account = (
            "Duobė išsiplėtė per visą juostą, gylis apie 15 cm, "
            "vakare jos nesimato ir automobiliai į ją įvažiuoja."
        )
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": account},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["description"] == account

    def test_records_the_urgency_the_resident_voted_for(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """An answer is also where a resident says how urgent it looks."""
        response = auth_client.post(
            _url(problem),
            {
                "is_valid": True,
                "description": "Still here.",
                "urgency": ProblemUrgency.DANGEROUS_TO_LIFE,
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["urgency"] == ProblemUrgency.DANGEROUS_TO_LIFE
        assert Validation.objects.get().urgency == ProblemUrgency.DANGEROUS_TO_LIFE

    def test_urgency_votes_move_the_problem(
        self,
        auth_client: APIClient,
        other_auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Two residents calling it dangerous outvote the original report."""
        problem.urgency = ProblemUrgency.CAN_WAIT
        problem.reported_urgency = ProblemUrgency.CAN_WAIT
        problem.save(update_fields=["urgency", "reported_urgency"])

        for client in (auth_client, other_auth_client):
            response = client.post(
                _url(problem),
                {
                    "is_valid": True,
                    "description": "Still here.",
                    "urgency": ProblemUrgency.DANGEROUS_TO_LIFE,
                },
                format="multipart",
            )
            assert response.status_code == HTTPStatus.CREATED

        problem.refresh_from_db()
        assert problem.urgency == ProblemUrgency.DANGEROUS_TO_LIFE
        # What the report said is kept, so re-tallying can't drift.
        assert problem.reported_urgency == ProblemUrgency.CAN_WAIT

    def test_urgency_is_optional(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Answering "still there" with no opinion on urgency is allowed."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here."},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert _body(response)["urgency"] == ""

    def test_rejects_an_urgency_outside_the_choices(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Urgency is one of the three levels, not free text."""
        response = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here.", "urgency": "whenever"},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_attaches_several_photos_and_a_video(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """A resident can back one answer with several files."""
        response = auth_client.post(
            _url(problem),
            {
                "is_valid": True,
                "description": "Still here, from two angles.",
                "media": [_photo("one.jpg"), _photo("two.jpg"), _video("clip.mp4")],
            },
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        kinds = sorted(media.type for media in Validation.objects.get().media.all())
        assert kinds == [MediaType.PHOTO, MediaType.PHOTO, MediaType.VIDEO]
        assert len(cast("list[object]", _body(response)["media"])) == MEDIA_COUNT

    def test_a_second_answer_is_refused(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """One answer per person: a vote that can be revised can be gamed."""
        first = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here."},
            format="multipart",
        )
        second = auth_client.post(
            _url(problem),
            {"is_valid": False, "description": "Actually it is fixed."},
            format="multipart",
        )

        assert first.status_code == HTTPStatus.CREATED
        assert second.status_code == HTTPStatus.CONFLICT
        assert Validation.objects.count() == 1
        assert Validation.objects.get().is_valid is True

    def test_the_reporter_cannot_also_answer(
        self,
        auth_client: APIClient,
        problem: Problem,
        report: Report,
    ) -> None:
        """Reporting a problem is your say on it; answering too is refused."""
        del report
        response = auth_client.post(
            _url(problem),
            {"is_valid": True},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CONFLICT

    def test_another_resident_can_still_answer(
        self,
        auth_client: APIClient,
        other_auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """The limit is one answer per person, not one answer per problem."""
        _ = auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here."},
            format="multipart",
        )
        response = other_auth_client.post(
            _url(problem),
            {"is_valid": True, "description": "Still here too."},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.CREATED
        assert Validation.objects.count() == TWO_ANSWERS

    def test_unknown_problem_is_not_found(self, auth_client: APIClient) -> None:
        """Validating a problem that doesn't exist is a 404, not a 500."""
        response = auth_client.post(
            f"{PROBLEMS_URL}/{uuid4()}/validations",
            {"is_valid": True, "description": "Still here.", "media": [_photo()]},
            format="multipart",
        )

        assert response.status_code == HTTPStatus.NOT_FOUND
