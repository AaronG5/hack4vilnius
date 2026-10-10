"""Tests for the registration, login and Google sign-in serializers."""

from typing import TYPE_CHECKING, cast

import pytest
from rest_framework import serializers
from rest_framework.test import APIRequestFactory
from users.models import User
from users.serializers import (
    GoogleAuthSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserRefSerializer,
)
from vilnius_backend.choices import UserRole

if TYPE_CHECKING:
    from rest_framework.exceptions import ErrorDetail


def _errors(serializer: serializers.Serializer[User]) -> dict[str, object]:
    """Return a serializer's validation errors, typed for test assertions."""
    return cast("dict[str, object]", serializer.errors)


class TestUserRefSerializer:
    """Tests for `UserRefSerializer`."""

    def test_exposes_only_id_and_name(self) -> None:
        """Need-to-know basis: a public user reference leaks nothing else."""
        user = User(id=1, email="agent@example.com", display_name="Agent")

        data = cast("dict[str, object]", UserRefSerializer(user).data)

        assert data == {"id": 1, "name": "Agent"}


class TestUserProfileSerializer:
    """Tests for `UserProfileSerializer`."""

    def test_exposes_the_contract_user_fields(self) -> None:
        """The own-profile shape carries the contract's `User` fields."""
        user = User(id=1, email="agent@example.com", display_name="Agent")

        data = cast("dict[str, object]", UserProfileSerializer(user).data)

        assert data["id"] == 1
        assert data["name"] == "Agent"
        assert data["email"] == "agent@example.com"
        assert data["role"] == UserRole.REGULAR_USER
        assert data["points"] == 0
        assert data["district"] is None

    def test_never_exposes_the_password(self) -> None:
        """The password hash is never part of the serialized profile."""
        user = User(id=1, email="agent@example.com", display_name="Agent")
        user.set_password("a-very-sturdy-passphrase")

        data = cast("dict[str, object]", UserProfileSerializer(user).data)

        assert "password" not in data


@pytest.mark.django_db
class TestRegisterSerializer:
    """Tests for `RegisterSerializer`."""

    def test_accepts_valid_data(self) -> None:
        """A unique email and strong password validate successfully."""
        serializer = RegisterSerializer(
            data={"email": "new@example.com", "password": "a-very-sturdy-passphrase"},
        )

        assert serializer.is_valid()

    def test_create_hashes_the_password(self) -> None:
        """Saving the serializer creates a user with a hashed password."""
        serializer = RegisterSerializer(
            data={
                "email": "new@example.com",
                "password": "a-very-sturdy-passphrase",
                "display_name": "New Citizen",
            },
        )
        assert serializer.is_valid()

        user = serializer.save()

        assert user.email == "new@example.com"
        assert user.display_name == "New Citizen"
        assert user.check_password("a-very-sturdy-passphrase")

    def test_display_name_defaults_to_empty_string(self) -> None:
        """Display name is optional and defaults to an empty string."""
        serializer = RegisterSerializer(
            data={"email": "new@example.com", "password": "a-very-sturdy-passphrase"},
        )
        assert serializer.is_valid()

        user = serializer.save()

        assert user.display_name == ""

    def test_rejects_duplicate_email(self) -> None:
        """An email already in use fails validation instead of hitting the DB."""
        _ = User.objects.create_user("existing@example.com", "a-very-sturdy-passphrase")

        serializer = RegisterSerializer(
            data={"email": "existing@example.com", "password": "another-sturdy-pass"},
        )

        assert not serializer.is_valid()
        assert "email" in _errors(serializer)

    def test_rejects_weak_password(self) -> None:
        """A password failing Django's validators is rejected."""
        serializer = RegisterSerializer(
            data={"email": "new@example.com", "password": "12345678"},
        )

        assert not serializer.is_valid()
        assert "password" in _errors(serializer)

    def test_requires_email_and_password(self) -> None:
        """Both email and password are required fields."""
        serializer = RegisterSerializer(data={})

        assert not serializer.is_valid()
        errors = _errors(serializer)
        assert "email" in errors
        assert "password" in errors


@pytest.mark.django_db
class TestLoginSerializer:
    """Tests for `LoginSerializer`."""

    @staticmethod
    def _serializer(email: str, password: str) -> LoginSerializer:
        request = APIRequestFactory().post("/")
        return LoginSerializer(
            data={"email": email, "password": password},
            context={"request": request},
        )

    def test_attaches_the_user_on_valid_credentials(self) -> None:
        """Valid credentials resolve to the matching user."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")
        serializer = self._serializer("agent@example.com", "correct-horse-1")

        assert serializer.is_valid()
        validated_data = cast("dict[str, object]", serializer.validated_data)
        assert validated_data["user"] == user

    def test_rejects_wrong_password(self) -> None:
        """An incorrect password is rejected without identifying which part failed."""
        _ = User.objects.create_user("agent@example.com", "correct-horse-1")
        serializer = self._serializer("agent@example.com", "wrong-password")

        assert not serializer.is_valid()
        non_field_errors = cast(
            "list[ErrorDetail]",
            _errors(serializer)["non_field_errors"],
        )
        assert non_field_errors[0].code == "authorization"

    def test_rejects_unknown_email(self) -> None:
        """An email with no matching account is rejected."""
        serializer = self._serializer("ghost@example.com", "whatever-1234")

        assert not serializer.is_valid()

    def test_rejects_inactive_user(self) -> None:
        """A deactivated account can't log in even with the right password."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")
        user.is_active = False
        user.save(update_fields=["is_active"])

        serializer = self._serializer("agent@example.com", "correct-horse-1")

        assert not serializer.is_valid()

    def test_rejects_google_only_account(self) -> None:
        """An account created via Google sign-in has no usable password."""
        _ = User.objects.create_user(
            "agent@example.com",
            None,
            google_sub="google-subject-123",
        )

        serializer = self._serializer("agent@example.com", "")

        assert not serializer.is_valid()


class TestGoogleAuthSerializer:
    """Tests for `GoogleAuthSerializer`."""

    def test_requires_id_token(self) -> None:
        """An ID token must be supplied."""
        serializer = GoogleAuthSerializer(data={})

        assert not serializer.is_valid()
        assert "id_token" in _errors(serializer)

    def test_accepts_an_id_token(self) -> None:
        """A present id_token validates successfully."""
        serializer = GoogleAuthSerializer(data={"id_token": "some-jwt"})

        assert serializer.is_valid()
