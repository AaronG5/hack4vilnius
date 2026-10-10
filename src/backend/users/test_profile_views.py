"""Tests for POST /api/session and GET/PUT /api/users/me."""

from http import HTTPStatus
from typing import cast
from uuid import uuid4

import pytest
from districts.models import District
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User
from vilnius_backend.choices import UserRole

SESSION_URL = "/api/session"
ME_URL = "/api/users/me"
FULL_TRUST = 100.0
TWO_VISITORS = 2


def _body(response: Response) -> dict[str, object]:
    """Return a response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


@pytest.mark.django_db
class TestSession:
    """Tests for `POST /api/session`."""

    def test_creates_an_anonymous_account_with_a_token(
        self,
        api_client: APIClient,
    ) -> None:
        """A new visitor gets a usable token without registering first."""
        response = api_client.post(SESSION_URL)

        assert response.status_code == HTTPStatus.CREATED
        body = _body(response)
        user = User.objects.get()
        assert Token.objects.filter(user=user, key=body["token"]).exists()

    def test_the_account_is_a_regular_user_with_no_points(
        self,
        api_client: APIClient,
    ) -> None:
        """An anonymous session starts as a regular citizen on zero points."""
        response = api_client.post(SESSION_URL)

        body = cast("dict[str, object]", _body(response)["user"])
        assert body["role"] == UserRole.REGULAR_USER
        assert body["points"] == 0
        assert body["district"] is None

    def test_the_account_cannot_be_logged_into_with_a_password(
        self,
        api_client: APIClient,
    ) -> None:
        """The throwaway account has no usable password."""
        _ = api_client.post(SESSION_URL)

        assert not User.objects.get().has_usable_password()

    def test_each_call_creates_a_separate_account(
        self,
        api_client: APIClient,
    ) -> None:
        """Two visitors get two distinct accounts and tokens."""
        first = _body(api_client.post(SESSION_URL))
        second = _body(APIClient().post(SESSION_URL))

        assert first["token"] != second["token"]
        assert User.objects.count() == TWO_VISITORS

    def test_the_token_works_on_an_authenticated_endpoint(
        self,
        api_client: APIClient,
    ) -> None:
        """The whole point of the session is being able to act straight away."""
        token = cast("str", _body(api_client.post(SESSION_URL))["token"])
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        response = client.get(ME_URL)

        assert response.status_code == HTTPStatus.OK


@pytest.mark.django_db
class TestProfileRead:
    """Tests for `GET /api/users/me`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """The own-profile endpoint needs a token."""
        response = api_client.get(ME_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_the_contract_fields(
        self,
        auth_client: APIClient,
        user: User,
    ) -> None:
        """The profile carries name, email, role, trust score and points."""
        response = auth_client.get(ME_URL)

        assert response.status_code == HTTPStatus.OK
        body = _body(response)
        assert body["id"] == user.pk
        assert body["name"] == "Citizen"
        assert body["email"] == "citizen@example.com"
        assert body["role"] == UserRole.REGULAR_USER
        assert body["trust_score"] == FULL_TRUST
        assert body["points"] == 0
        assert body["created_at"] is not None

    def test_never_exposes_the_password(self, auth_client: APIClient) -> None:
        """The password hash is not part of the profile."""
        response = auth_client.get(ME_URL)

        assert "password" not in _body(response)

    def test_nests_the_home_district(
        self,
        auth_client: APIClient,
        user: User,
        district: District,
    ) -> None:
        """A user's home district is nested, not just referenced."""
        user.district = district
        user.save(update_fields=["district"])

        response = auth_client.get(ME_URL)

        nested = cast("dict[str, object]", _body(response)["district"])
        assert nested["id"] == str(district.id)
        assert nested["name"] == "Senamiestis"


@pytest.mark.django_db
class TestProfileUpdate:
    """Tests for `PUT /api/users/me`."""

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """Updating a profile without a token is rejected."""
        response = api_client.put(ME_URL, {"name": "Someone"}, format="json")

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_updates_the_name(self, auth_client: APIClient, user: User) -> None:
        """The contract's `name` maps onto the stored display name."""
        response = auth_client.put(ME_URL, {"name": "Renamed"}, format="json")

        assert response.status_code == HTTPStatus.OK
        assert _body(response)["name"] == "Renamed"
        user.refresh_from_db()
        assert user.display_name == "Renamed"

    def test_updates_the_email(self, auth_client: APIClient, user: User) -> None:
        """A user can change their own email address."""
        response = auth_client.put(
            ME_URL,
            {"email": "new.address@example.com"},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        user.refresh_from_db()
        assert user.email == "new.address@example.com"

    def test_sets_the_home_district_by_id(
        self,
        auth_client: APIClient,
        user: User,
        district: District,
    ) -> None:
        """The district is supplied as an id and returned nested."""
        response = auth_client.put(
            ME_URL,
            {"district": str(district.id)},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        user.refresh_from_db()
        assert user.district == district

    def test_leaves_unsent_fields_untouched(
        self,
        auth_client: APIClient,
        user: User,
    ) -> None:
        """A partial update doesn't blank the fields it omits."""
        _ = auth_client.put(ME_URL, {"name": "Renamed"}, format="json")

        user.refresh_from_db()
        assert user.email == "citizen@example.com"

    def test_rejects_an_invalid_email(self, auth_client: APIClient) -> None:
        """A malformed email address is a 400."""
        response = auth_client.put(ME_URL, {"email": "not-an-email"}, format="json")

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_rejects_an_unknown_district(self, auth_client: APIClient) -> None:
        """A district id with no matching district is a 400."""
        response = auth_client.put(ME_URL, {"district": str(uuid4())}, format="json")

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_cannot_self_promote(self, auth_client: APIClient, user: User) -> None:
        """Role, points and trust score are read-only to their owner."""
        response = auth_client.put(
            ME_URL,
            {"role": UserRole.STAFF, "points": 9999, "trust_score": 1000.0},
            format="json",
        )

        assert response.status_code == HTTPStatus.OK
        user.refresh_from_db()
        assert user.role == UserRole.REGULAR_USER
        assert user.points == 0
        assert user.trust_score == FULL_TRUST
