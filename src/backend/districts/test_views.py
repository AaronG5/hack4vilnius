"""Tests for GET /api/districts."""

from http import HTTPStatus
from typing import cast

import pytest
from districts.models import District
from rest_framework.response import Response
from rest_framework.test import APIClient

DISTRICTS_URL = "/api/districts"


def _entries(response: Response) -> list[dict[str, object]]:
    """Return a list response's JSON body, typed for test assertions."""
    return cast("list[dict[str, object]]", response.data)


@pytest.mark.django_db
class TestDistrictList:
    """Tests for `GET /api/districts`."""

    def test_is_public(self, api_client: APIClient, district: District) -> None:
        """Districts are readable without a token: the contract sets no security."""
        del district
        response = api_client.get(DISTRICTS_URL)

        assert response.status_code == HTTPStatus.OK
        assert len(_entries(response)) == 1

    def test_returns_the_contract_fields(
        self,
        api_client: APIClient,
        district: District,
    ) -> None:
        """Each district carries its name, boundary, city and region."""
        response = api_client.get(DISTRICTS_URL)

        entry = _entries(response)[0]
        assert entry["id"] == str(district.id)
        assert entry["name"] == "Senamiestis"
        assert entry["city"] == "Vilnius"
        assert entry["region"] == "Vilniaus apskritis"
        boundary = cast("dict[str, object]", entry["boundary"])
        assert boundary["type"] == "Polygon"

    def test_returns_an_empty_list_when_none_exist(self, api_client: APIClient) -> None:
        """No districts configured is an empty list, not an error."""
        response = api_client.get(DISTRICTS_URL)

        assert response.status_code == HTTPStatus.OK
        assert _entries(response) == []
