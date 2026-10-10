"""Tests for the problem endpoints."""

from http import HTTPStatus
from typing import TYPE_CHECKING, cast
from uuid import uuid4

import pytest
from categories.models import Category
from districts.models import District
from notifications.models import Notification
from problems.models import Problem
from reports.models import Report
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import ProblemStatus, ProblemUrgency

if TYPE_CHECKING:
    from pytest_django.fixtures import Settings

PROBLEMS_URL = "/api/problems"
NEUTRAL_SCORE = 50.0


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


def _body(response: Response) -> dict[str, object]:
    """Return a detail response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


@pytest.mark.django_db
class TestProblemList:
    """Tests for `GET /api/problems`."""

    def test_is_public(self, api_client: APIClient, problem: Problem) -> None:
        """The map needs problems before login, so the list is public."""
        del problem
        response = api_client.get(PROBLEMS_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        problem: Problem,
        category: Category,
    ) -> None:
        """A problem carries its status, urgency, score, location and category."""
        response = api_client.get(PROBLEMS_URL)

        entry = _entries(response)[0]
        assert entry["id"] == str(problem.id)
        assert entry["status"] == ProblemStatus.UNCONFIRMED
        assert entry["urgency"] == ProblemUrgency.URGENT
        assert entry["legitimacy_score"] == NEUTRAL_SCORE
        location = cast("dict[str, object]", entry["location"])
        assert location["type"] == "Point"
        nested = cast("dict[str, object]", entry["category"])
        assert nested["id"] == str(category.id)

    def test_filters_by_status(self, api_client: APIClient, problem: Problem) -> None:
        """`?status=` narrows the list to matching problems."""
        response = api_client.get(PROBLEMS_URL, {"status": ProblemStatus.CONFIRMED})

        assert _entries(response) == []

        matching = api_client.get(PROBLEMS_URL, {"status": problem.status})
        assert len(_entries(matching)) == 1

    def test_filters_by_urgency(self, api_client: APIClient, problem: Problem) -> None:
        """`?urgency=` narrows the list to matching problems."""
        del problem
        response = api_client.get(PROBLEMS_URL, {"urgency": ProblemUrgency.CAN_WAIT})

        assert _entries(response) == []

    def test_filters_by_category(
        self,
        api_client: APIClient,
        problem: Problem,
        category: Category,
    ) -> None:
        """`?category=` narrows the list to problems in that category."""
        del problem
        response = api_client.get(PROBLEMS_URL, {"category": str(category.id)})

        assert len(_entries(response)) == 1

        other = Category.objects.create(
            name="Other",
            description="Anything else.",
            icon="https://example.com/icons/other.svg",
            default_urgency=ProblemUrgency.CAN_WAIT,
        )
        empty = api_client.get(PROBLEMS_URL, {"category": str(other.id)})
        assert _entries(empty) == []

    def test_filtering_by_district_matches_nothing_while_stubbed(
        self,
        api_client: APIClient,
        problem: Problem,
        district: District,
    ) -> None:
        """District resolution is stubbed, so a district filter matches nothing."""
        del problem
        response = api_client.get(PROBLEMS_URL, {"district": str(district.id)})

        assert response.status_code == HTTPStatus.OK
        assert _entries(response) == []


@pytest.mark.django_db
class TestProblemDetail:
    """Tests for `GET /api/problems/{id}`."""

    def test_includes_reports_and_validations(
        self,
        api_client: APIClient,
        problem: Problem,
        report: Report,
        validation: Validation,
    ) -> None:
        """The detail view nests the problem's reports and validations."""
        response = api_client.get(f"{PROBLEMS_URL}/{problem.id}")

        assert response.status_code == HTTPStatus.OK
        body = _body(response)
        reports = cast("list[dict[str, object]]", body["reports"])
        validations = cast("list[dict[str, object]]", body["validations"])
        assert [entry["id"] for entry in reports] == [str(report.id)]
        assert [entry["id"] for entry in validations] == [str(validation.id)]

    def test_nested_reports_use_the_public_user_reference(
        self,
        api_client: APIClient,
        problem: Problem,
        report: Report,
    ) -> None:
        """Need-to-know basis: a nested reporter exposes only id and name."""
        del report
        response = api_client.get(f"{PROBLEMS_URL}/{problem.id}")

        reports = cast("list[dict[str, object]]", _body(response)["reports"])
        reporter = cast("dict[str, object]", reports[0]["user"])
        assert set(reporter) == {"id", "name"}

    def test_unknown_id_is_not_found(self, api_client: APIClient) -> None:
        """A problem id that doesn't exist is a 404."""
        response = api_client.get(f"{PROBLEMS_URL}/{uuid4()}")

        assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.django_db
class TestProblemStatusUpdate:
    """Tests for `PUT /api/problems/{id}/status`."""

    def test_requires_authentication(
        self,
        api_client: APIClient,
        problem: Problem,
    ) -> None:
        """Anonymous callers can't change a problem's status."""
        response = api_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_rejects_regular_users(
        self,
        auth_client: APIClient,
        problem: Problem,
    ) -> None:
        """Only staff and city administrators may change a status."""
        response = auth_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_anyone_signed_in_may_while_city_tools_are_open(
        self,
        auth_client: APIClient,
        problem: Problem,
        settings: "Settings",
    ) -> None:
        """With no staff login yet, development lets any signed-in user act."""
        settings.CITY_TOOLS_FOR_EVERYONE = True
        response = auth_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK

    def test_open_city_tools_still_need_a_session(
        self,
        api_client: APIClient,
        problem: Problem,
        settings: "Settings",
    ) -> None:
        """Opening the tools never extends to anonymous callers."""
        settings.CITY_TOOLS_FOR_EVERYONE = True
        response = api_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_handing_over_assigns_the_categorys_institution(
        self,
        staff_client: APIClient,
        problem: Problem,
    ) -> None:
        """A problem passed on without an institution goes to its category's."""
        _ = staff_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.PENDING},
            format="json",
        )

        problem.refresh_from_db()
        assert problem.institution == problem.category.institution

    def test_staff_can_change_the_status(
        self,
        staff_client: APIClient,
        problem: Problem,
    ) -> None:
        """Staff get the updated problem back, and the change is persisted."""
        response = staff_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        assert _body(response)["status"] == ProblemStatus.ONGOING
        problem.refresh_from_db()
        assert problem.status == ProblemStatus.ONGOING

    def test_notifies_reporters_and_validators(
        self,
        staff_client: APIClient,
        problem: Problem,
        report: Report,
        validation: Validation,
    ) -> None:
        """Everyone involved with the problem is notified of the change."""
        _ = staff_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        notified = set(
            Notification.objects.filter(problem=problem).values_list(
                "user_id",
                flat=True,
            ),
        )
        assert notified == {report.user.pk, validation.user.pk}

    def test_rejects_an_unknown_status(
        self,
        staff_client: APIClient,
        problem: Problem,
    ) -> None:
        """A status outside the contract's enum is a 400."""
        response = staff_client.put(
            f"{PROBLEMS_URL}/{problem.id}/status",
            {"status": "teleported"},
            format="json",
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_unknown_problem_is_not_found(
        self,
        staff_client: APIClient,
        user: User,
    ) -> None:
        """Updating a problem that doesn't exist is a 404, not a 500."""
        del user
        response = staff_client.put(
            f"{PROBLEMS_URL}/{uuid4()}/status",
            {"status": ProblemStatus.ONGOING},
            format="json",
        )

        assert response.status_code == HTTPStatus.NOT_FOUND
