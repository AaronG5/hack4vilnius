"""Tests for registration, login, logout and Google sign-in."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import cast

import pytest
from pytest_django.fixtures import Settings
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.test import APIClient
from users.models import User

REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
GOOGLE_URL = "/api/auth/google/"


def _body(response: Response) -> dict[str, object]:
    """Return a response's JSON body, typed for test assertions."""
    return cast("dict[str, object]", response.data)


@pytest.fixture
def api_client() -> APIClient:
    """Return an unauthenticated DRF test client."""
    return APIClient()


@pytest.mark.django_db
class TestRegister:
    """Tests for POST /api/auth/register/."""

    def test_creates_user_and_returns_token(self, api_client: APIClient) -> None:
        """Registering with a new email creates the account and a token."""
        response = api_client.post(
            REGISTER_URL,
            {
                "email": "new.citizen@example.com",
                "password": "a-very-sturdy-passphrase",
                "display_name": "New Citizen",
            },
        )

        assert response.status_code == HTTPStatus.CREATED
        body = _body(response)
        user_data = cast("dict[str, object]", body["user"])
        assert user_data["email"] == "new.citizen@example.com"
        user = User.objects.get(email="new.citizen@example.com")
        assert Token.objects.filter(user=user, key=body["token"]).exists()

    def test_rejects_duplicate_email(self, api_client: APIClient) -> None:
        """Registering twice with the same email is rejected."""
        _ = User.objects.create_user("existing@example.com", "a-very-sturdy-passphrase")

        response = api_client.post(
            REGISTER_URL,
            {"email": "existing@example.com", "password": "another-sturdy-pass"},
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert "email" in _body(response)

    def test_rejects_weak_password(self, api_client: APIClient) -> None:
        """Registering with a weak password is rejected."""
        response = api_client.post(
            REGISTER_URL,
            {"email": "weak@example.com", "password": "12345678"},
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert "password" in _body(response)

    def test_rejects_missing_fields(self, api_client: APIClient) -> None:
        """Registering without an email or password is rejected."""
        response = api_client.post(REGISTER_URL, {})

        assert response.status_code == HTTPStatus.BAD_REQUEST
        body = _body(response)
        assert "email" in body
        assert "password" in body

    def test_does_not_leak_the_password_in_the_response(
        self,
        api_client: APIClient,
    ) -> None:
        """The response body never echoes back the password."""
        response = api_client.post(
            REGISTER_URL,
            {"email": "new.citizen@example.com", "password": "a-very-sturdy-pass"},
        )

        body = _body(response)
        user_data = cast("dict[str, object]", body["user"])
        assert "password" not in user_data


@pytest.mark.django_db
class TestLogin:
    """Tests for POST /api/auth/login/."""

    def test_logs_in_with_correct_credentials(self, api_client: APIClient) -> None:
        """Logging in with correct credentials returns a token."""
        _ = User.objects.create_user("agent@example.com", "correct-horse-1")

        response = api_client.post(
            LOGIN_URL,
            {"email": "agent@example.com", "password": "correct-horse-1"},
        )

        assert response.status_code == HTTPStatus.OK
        body = _body(response)
        user_data = cast("dict[str, object]", body["user"])
        assert user_data["email"] == "agent@example.com"
        assert body["token"]

    def test_rejects_wrong_password(self, api_client: APIClient) -> None:
        """Logging in with the wrong password is rejected."""
        _ = User.objects.create_user("agent@example.com", "correct-horse-1")

        response = api_client.post(
            LOGIN_URL,
            {"email": "agent@example.com", "password": "wrong-password"},
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_rejects_unknown_email(self, api_client: APIClient) -> None:
        """Logging in with an email that has no account is rejected."""
        response = api_client.post(
            LOGIN_URL,
            {"email": "ghost@example.com", "password": "whatever-1234"},
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_rejects_missing_fields(self, api_client: APIClient) -> None:
        """Logging in without an email or password is rejected."""
        response = api_client.post(LOGIN_URL, {})

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_rejects_google_only_account(self, api_client: APIClient) -> None:
        """An account with no usable password can't log in with one."""
        _ = User.objects.create_user(
            "citizen@gmail.com",
            None,
            google_sub="google-subject-123",
        )

        response = api_client.post(
            LOGIN_URL,
            {"email": "citizen@gmail.com", "password": ""},
        )

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_returns_a_stable_token_across_repeated_logins(
        self,
        api_client: APIClient,
    ) -> None:
        """Logging in twice returns the same token rather than minting a new one."""
        _ = User.objects.create_user("agent@example.com", "correct-horse-1")
        credentials = {"email": "agent@example.com", "password": "correct-horse-1"}

        first = _body(api_client.post(LOGIN_URL, credentials))
        second = _body(api_client.post(LOGIN_URL, credentials))

        assert first["token"] == second["token"]


@pytest.mark.django_db
class TestLogout:
    """Tests for POST /api/auth/logout/."""

    def test_revokes_token_for_authenticated_user(self, api_client: APIClient) -> None:
        """Logging out deletes the user's token."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")
        token = Token.objects.create(user=user)
        key = cast("str", token.key)
        api_client.credentials(HTTP_AUTHORIZATION=f"Token {key}")

        response = api_client.post(LOGOUT_URL)

        assert response.status_code == HTTPStatus.NO_CONTENT
        assert not Token.objects.filter(user=user).exists()

    def test_requires_authentication(self, api_client: APIClient) -> None:
        """Logging out without a token is rejected."""
        response = api_client.post(LOGOUT_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_token_is_invalid_after_logout(self, api_client: APIClient) -> None:
        """A revoked token can't be used for a second logout."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")
        token = Token.objects.create(user=user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Token {cast('str', token.key)}")
        _ = api_client.post(LOGOUT_URL)

        response = api_client.post(LOGOUT_URL)

        assert response.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.django_db
class TestGoogleAuth:
    """Tests for POST /api/auth/google/."""

    @pytest.fixture(autouse=True)
    def _configure_client_id(self, settings: Settings) -> None:
        """Configure a Google OAuth client ID for every test in this class."""
        settings.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com"

    @staticmethod
    def _google_payload(**overrides: object) -> dict[str, object]:
        """Build a verified Google ID token payload, with optional overrides."""
        payload: dict[str, object] = {
            "sub": "google-subject-123",
            "email": "citizen@gmail.com",
            "email_verified": True,
            "name": "Citizen Agent",
        }
        payload.update(overrides)
        return payload

    @staticmethod
    def _patch_verify(
        monkeypatch: pytest.MonkeyPatch,
        payload: Mapping[str, object],
    ) -> None:
        """Stub the Google ID token verifier to return the given payload."""

        def _verify(*_args: object, **_kwargs: object) -> Mapping[str, object]:
            return payload

        monkeypatch.setattr("users.views.google_id_token.verify_oauth2_token", _verify)

    def test_requires_id_token(self, api_client: APIClient) -> None:
        """Calling the endpoint without an ID token is rejected."""
        response = api_client.post(GOOGLE_URL, {})

        assert response.status_code == HTTPStatus.BAD_REQUEST

    def test_creates_user_on_first_sign_in(
        self,
        api_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A first Google sign-in creates an account with no usable password."""
        self._patch_verify(monkeypatch, self._google_payload())

        response = api_client.post(GOOGLE_URL, {"id_token": "fake-token"})

        assert response.status_code == HTTPStatus.CREATED
        user = User.objects.get(email="citizen@gmail.com")
        assert user.google_sub == "google-subject-123"
        assert not user.has_usable_password()

    def test_logs_in_returning_user_by_google_sub(
        self,
        api_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A returning Google user is matched by their stored subject id."""
        _ = User.objects.create_user(
            "citizen@gmail.com",
            None,
            google_sub="google-subject-123",
        )
        self._patch_verify(monkeypatch, self._google_payload())

        response = api_client.post(GOOGLE_URL, {"id_token": "fake-token"})

        assert response.status_code == HTTPStatus.OK
        assert User.objects.count() == 1

    def test_links_google_sub_to_existing_email_account(
        self,
        api_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Signing in with Google links to an existing password account by email."""
        existing = User.objects.create_user(
            "citizen@gmail.com",
            "a-very-sturdy-passphrase",
        )
        self._patch_verify(monkeypatch, self._google_payload())

        response = api_client.post(GOOGLE_URL, {"id_token": "fake-token"})

        assert response.status_code == HTTPStatus.OK
        existing.refresh_from_db()
        assert existing.google_sub == "google-subject-123"

    def test_rejects_unverified_email(
        self,
        api_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A Google account with an unverified email is rejected."""
        self._patch_verify(monkeypatch, self._google_payload(email_verified=False))

        response = api_client.post(GOOGLE_URL, {"id_token": "fake-token"})

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_rejects_invalid_token(
        self,
        api_client: APIClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """An expired or malformed Google ID token is rejected."""

        def _raise(*_args: object, **_kwargs: object) -> Mapping[str, object]:
            msg = "Token used too late"
            raise ValueError(msg)

        monkeypatch.setattr(
            "users.views.google_id_token.verify_oauth2_token",
            _raise,
        )

        response = api_client.post(GOOGLE_URL, {"id_token": "stale-token"})

        assert response.status_code == HTTPStatus.UNAUTHORIZED

    def test_returns_503_when_not_configured(
        self,
        api_client: APIClient,
        settings: Settings,
    ) -> None:
        """Google sign-in is disabled while no client ID is configured."""
        settings.GOOGLE_OAUTH_CLIENT_ID = ""

        response = api_client.post(GOOGLE_URL, {"id_token": "fake-token"})

        assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
