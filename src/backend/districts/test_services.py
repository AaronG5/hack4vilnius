"""Tests for the (stubbed) district resolution service."""

import pytest
from districts.models import District
from districts.services import get_district_for_point

VILNIUS_POINT: dict[str, object] = {"type": "Point", "coordinates": [25.28, 54.69]}


@pytest.mark.django_db
class TestGetDistrictForPoint:
    """Tests for `get_district_for_point`."""

    def test_returns_none_while_stubbed(self, district: District) -> None:
        """The stub never matches a district, even one covering the point."""
        del district

        assert get_district_for_point(VILNIUS_POINT) is None

    def test_returns_none_without_any_districts(self) -> None:
        """No districts configured also resolves to `None`, not an error."""
        assert get_district_for_point(VILNIUS_POINT) is None
