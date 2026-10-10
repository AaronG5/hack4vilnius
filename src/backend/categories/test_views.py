"""Tests for GET /api/categories."""

from http import HTTPStatus
from typing import cast

import pytest
from categories.models import Category
from institutions.models import Institution
from rest_framework.response import Response
from rest_framework.test import APIClient
from vilnius_backend.choices import ProblemUrgency

CATEGORIES_URL = "/api/categories"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


@pytest.mark.django_db
class TestCategoryList:
    """Tests for `GET /api/categories`."""

    def test_is_public(self, api_client: APIClient, category: Category) -> None:
        """Categories are readable without a token."""
        del category
        response = api_client.get(CATEGORIES_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        category: Category,
    ) -> None:
        """Each category carries its description, icon and default urgency."""
        response = api_client.get(CATEGORIES_URL)

        entry = _entries(response)[0]
        assert entry["id"] == str(category.id)
        assert entry["name"] == "Pothole"
        assert entry["description"] == "Damaged road surface."
        assert entry["default_urgency"] == ProblemUrgency.URGENT

    def test_nests_the_responsible_institution(
        self,
        api_client: APIClient,
        category: Category,
        institution: Institution,
    ) -> None:
        """The institution handling the category is nested, not just referenced."""
        del category
        response = api_client.get(CATEGORIES_URL)

        nested = cast("dict[str, object]", _entries(response)[0]["institution"])
        assert nested["id"] == str(institution.id)
        assert nested["name"] == institution.name

    def test_institution_is_null_when_unassigned(self, api_client: APIClient) -> None:
        """A category with no institution serializes it as `null`."""
        _ = Category.objects.create(
            name="Other",
            description="Anything else.",
            icon="https://example.com/icons/other.svg",
            default_urgency=ProblemUrgency.CAN_WAIT,
        )

        response = api_client.get(CATEGORIES_URL)

        assert _entries(response)[0]["institution"] is None
