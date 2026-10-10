"""Shared pytest fixtures for the backend test suite."""

import datetime as dt
from pathlib import Path
from typing import TYPE_CHECKING, cast

import pytest
from badges.models import Badge
from categories.models import Category
from challenges.models import Challenge
from districts.models import District
from django.core.files.uploadedfile import SimpleUploadedFile
from institutions.models import Institution
from moderation.models import ModerationFlag
from problems.models import Problem
from reports.models import Report
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from users.models import User
from validations.models import Validation
from vilnius_backend.choices import (
    ModerationFlagStatus,
    ProblemStatus,
    ProblemUrgency,
    UserRole,
)

if TYPE_CHECKING:
    from pytest_django.fixtures import Settings

VILNIUS_POINT: dict[str, object] = {"type": "Point", "coordinates": [25.28, 54.69]}
SENAMIESTIS_BOUNDARY: dict[str, object] = {
    "type": "Polygon",
    "coordinates": [[[25.2, 54.6], [25.4, 54.6], [25.4, 54.8], [25.2, 54.8]]],
}


@pytest.fixture(autouse=True)
def _media_root(settings: "Settings", tmp_path: Path) -> None:
    """Keep uploaded test files out of the repository."""
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture
def api_client() -> APIClient:
    """Return an unauthenticated DRF test client."""
    return APIClient()


def authenticate(client: APIClient, user: User) -> APIClient:
    """Attach `user`'s API token to `client`."""
    token, _created = Token.objects.get_or_create(user=user)
    key = cast("str", token.key)  # `Token.key` is a bare `CharField` in the stubs.
    client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
    return client


@pytest.fixture
def user() -> User:
    """Return a regular citizen account."""
    return User.objects.create_user(
        "citizen@example.com",
        "a-very-sturdy-passphrase",
        display_name="Citizen",
    )


@pytest.fixture
def other_user() -> User:
    """Return a second, unrelated citizen account."""
    return User.objects.create_user(
        "other@example.com",
        "a-very-sturdy-passphrase",
        display_name="Other Citizen",
    )


@pytest.fixture
def staff_user() -> User:
    """Return a staff account, allowed to moderate and change statuses."""
    return User.objects.create_user(
        "staff@example.com",
        "a-very-sturdy-passphrase",
        display_name="Staff Member",
        role=UserRole.STAFF,
    )


@pytest.fixture
def city_admin() -> User:
    """Return a city administrator account."""
    return User.objects.create_user(
        "admin@example.com",
        "a-very-sturdy-passphrase",
        display_name="City Admin",
        role=UserRole.CITY_ADMINISTRATOR,
    )


@pytest.fixture
def auth_client(api_client: APIClient, user: User) -> APIClient:
    """Return a client authenticated as the regular citizen."""
    return authenticate(api_client, user)


@pytest.fixture
def other_auth_client(other_user: User) -> APIClient:
    """Return a client authenticated as an unrelated citizen."""
    return authenticate(APIClient(), other_user)


@pytest.fixture
def staff_client(api_client: APIClient, staff_user: User) -> APIClient:
    """Return a client authenticated as staff."""
    return authenticate(api_client, staff_user)


@pytest.fixture
def admin_client(api_client: APIClient, city_admin: User) -> APIClient:
    """Return a client authenticated as a city administrator."""
    return authenticate(api_client, city_admin)


@pytest.fixture
def district() -> District:
    """Return a city district with a boundary polygon."""
    return District.objects.create(
        name="Senamiestis",
        boundary=SENAMIESTIS_BOUNDARY,
        city="Vilnius",
        region="Vilniaus apskritis",
    )


@pytest.fixture
def institution() -> Institution:
    """Return the institution responsible for road problems."""
    return Institution.objects.create(
        name="Vilniaus miesto savivaldybė",
        contact_info="info@vilnius.lt",
    )


@pytest.fixture
def category(institution: Institution) -> Category:
    """Return a problem category with a responsible institution."""
    return Category.objects.create(
        name="Pothole",
        description="Damaged road surface.",
        icon="https://example.com/icons/pothole.svg",
        default_urgency=ProblemUrgency.URGENT,
        institution=institution,
    )


@pytest.fixture
def problem(category: Category) -> Problem:
    """Return an unconfirmed problem in the city centre."""
    return Problem.objects.create(
        status=ProblemStatus.UNCONFIRMED,
        urgency=ProblemUrgency.URGENT,
        legitimacy_score=50.0,
        location=VILNIUS_POINT,
        category=category,
    )


@pytest.fixture
def report(problem: Problem, user: User) -> Report:
    """Return a report filed by the regular citizen."""
    return Report.objects.create(
        description="There is a large pothole here.",
        user=user,
        problem=problem,
    )


@pytest.fixture
def validation(problem: Problem, other_user: User) -> Validation:
    """Return a validation confirming the problem."""
    return Validation.objects.create(
        is_valid=True,
        description="Still there, I nearly fell in.",
        points_awarded=10,
        user=other_user,
        problem=problem,
    )


@pytest.fixture
def badge(district: District) -> Badge:
    """Return a district-scoped validation-count badge."""
    return Badge.objects.create(
        name="Senamiestis Scout",
        description="Validate ten problems in Senamiestis.",
        icon="https://example.com/icons/scout.svg",
        criteria="Validate 10 problems in Senamiestis.",
        required_validation_count=10,
        district=district,
    )


@pytest.fixture
def challenge(category: Category) -> Challenge:
    """Return an active challenge targeting the pothole category."""
    instance = Challenge.objects.create(
        name="Spring Clean-up",
        description="Report and validate as many potholes as you can.",
        start_date=dt.date(2026, 3, 1),
        end_date=dt.date(2026, 4, 1),
        reward_points=500,
    )
    instance.categories.add(category)
    return instance


@pytest.fixture
def moderation_flag(report: Report) -> ModerationFlag:
    """Return a pending moderation flag on the citizen's report."""
    return ModerationFlag.objects.create(
        report=report,
        reason="Flagged by automated content screening.",
        status=ModerationFlagStatus.PENDING,
    )


@pytest.fixture
def photo() -> SimpleUploadedFile:
    """Return a small in-memory JPEG upload."""
    return SimpleUploadedFile(
        "photo.jpg", b"fake-jpeg-bytes", content_type="image/jpeg"
    )
