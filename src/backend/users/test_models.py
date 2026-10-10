"""Tests for the `User` model and its manager."""

import pytest
from django.db import IntegrityError
from users.models import AnonymousIdentity, User


@pytest.mark.django_db
class TestUserManagerCreateUser:
    """Tests for `UserManager.create_user`."""

    def test_hashes_the_password(self) -> None:
        """The stored password is hashed, not stored in plain text."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")

        assert user.password.startswith("pbkdf2_sha256$")
        assert user.check_password("correct-horse-1")

    def test_normalizes_the_email_domain(self) -> None:
        """The domain part of the email is lowercased on creation."""
        user = User.objects.create_user("Agent@EXAMPLE.COM", "correct-horse-1")

        assert user.email == "Agent@example.com"

    def test_requires_an_email_address(self) -> None:
        """Creating a user without an email raises."""
        with pytest.raises(ValueError, match="email"):
            _ = User.objects.create_user("", "correct-horse-1")

    def test_defaults_to_a_regular_non_staff_user(self) -> None:
        """A plain `create_user` call never grants staff or superuser status."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")

        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.is_active is True

    def test_without_a_password_is_unusable(self) -> None:
        """Google-only accounts (no password) can't authenticate by password."""
        user = User.objects.create_user("agent@example.com", None)

        assert not user.has_usable_password()


@pytest.mark.django_db
class TestUserManagerCreateSuperuser:
    """Tests for `UserManager.create_superuser`."""

    def test_sets_staff_and_superuser_flags(self) -> None:
        """A superuser is both staff and superuser by default."""
        user = User.objects.create_superuser("admin@example.com", "correct-horse-1")

        assert user.is_staff is True
        assert user.is_superuser is True

    def test_rejects_is_staff_false(self) -> None:
        """Explicitly disabling staff status on a superuser is rejected."""
        with pytest.raises(ValueError, match="is_staff"):
            _ = User.objects.create_superuser(
                "admin@example.com",
                "correct-horse-1",
                is_staff=False,
            )

    def test_rejects_is_superuser_false(self) -> None:
        """Explicitly disabling superuser status on a superuser is rejected."""
        with pytest.raises(ValueError, match="is_superuser"):
            _ = User.objects.create_superuser(
                "admin@example.com",
                "correct-horse-1",
                is_superuser=False,
            )


@pytest.mark.django_db
class TestUser:
    """Tests for the `User` model itself."""

    def test_str_returns_the_email(self) -> None:
        """`str(user)` is the user's email, used in the admin and shell."""
        user = User.objects.create_user("agent@example.com", "correct-horse-1")

        assert str(user) == "agent@example.com"

    def test_is_identified_by_email_not_username(self) -> None:
        """The model authenticates by email; there is no username field."""
        assert User.USERNAME_FIELD == "email"
        assert User.REQUIRED_FIELDS == []

    def test_email_must_be_unique(self) -> None:
        """Two accounts can't share the same email address."""
        _ = User.objects.create_user("agent@example.com", "correct-horse-1")

        with pytest.raises(IntegrityError, match="UNIQUE constraint"):
            _ = User.objects.create_user("agent@example.com", "another-password-1")

    def test_google_sub_must_be_unique(self) -> None:
        """Two accounts can't share the same Google subject id."""
        _ = User.objects.create_user(
            "first@example.com",
            None,
            google_sub="google-subject-123",
        )

        with pytest.raises(IntegrityError, match="UNIQUE constraint"):
            _ = User.objects.create_user(
                "second@example.com",
                None,
                google_sub="google-subject-123",
            )


@pytest.mark.django_db
class TestAnonymousIdentity:
    """Tests for the `AnonymousIdentity` model."""

    def test_is_not_claimed_when_created(self) -> None:
        """A freshly created identity has no owner yet."""
        identity = AnonymousIdentity.objects.create()

        assert identity.is_claimed is False
        assert identity.claimed_by is None
        assert identity.claimed_at is None

    def test_claim_attributes_the_identity_to_a_user(self) -> None:
        """Claiming sets both the owner and the claim timestamp."""
        identity = AnonymousIdentity.objects.create()
        user = User.objects.create_user("agent@example.com", "correct-horse-1")

        identity.claim(user)

        assert identity.is_claimed is True
        assert identity.claimed_by == user
        assert identity.claimed_at is not None

    def test_claim_persists_to_the_database(self) -> None:
        """The claim survives a fresh read from the database."""
        identity = AnonymousIdentity.objects.create()
        user = User.objects.create_user("agent@example.com", "correct-horse-1")

        identity.claim(user)
        reloaded = AnonymousIdentity.objects.get(pk=identity.id)

        assert reloaded.claimed_by == user

    def test_claim_is_idempotent(self) -> None:
        """Claiming an already-claimed identity again is a no-op."""
        identity = AnonymousIdentity.objects.create()
        first_owner = User.objects.create_user("first@example.com", "correct-horse-1")
        second_owner = User.objects.create_user(
            "second@example.com",
            "correct-horse-2",
        )

        identity.claim(first_owner)
        claimed_at = identity.claimed_at
        identity.claim(second_owner)

        assert identity.claimed_by == first_owner
        assert identity.claimed_at == claimed_at

    def test_str_returns_the_id(self) -> None:
        """`str(identity)` is its id, used in the admin and shell."""
        identity = AnonymousIdentity.objects.create()

        assert str(identity) == str(identity.id)
