"""User model and manager for email- and Google-based authentication."""

import datetime as dt
from typing import ClassVar, final, override

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.expressions import Combinable


@final
class UserManager(BaseUserManager["User"]):
    """Manager for `User`, keyed on email instead of username."""

    use_in_migrations = True

    def _create_user(
        self,
        email: str,
        password: str | None,
        **extra_fields: object,
    ) -> "User":
        if not email:
            msg = "Users must have an email address"
            raise ValueError(msg)
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        """Create and save a regular user with the given email and password."""
        _ = extra_fields.setdefault("is_staff", False)
        _ = extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(
        self,
        email: str,
        password: str | None = None,
        **extra_fields: object,
    ) -> "User":
        """Create and save a superuser with the given email and password."""
        _ = extra_fields.setdefault("is_staff", True)
        _ = extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            msg = "Superuser must have is_staff=True."
            raise ValueError(msg)
        if extra_fields.get("is_superuser") is not True:
            msg = "Superuser must have is_superuser=True."
            raise ValueError(msg)

        return self._create_user(email, password, **extra_fields)


@final
class User(AbstractBaseUser, PermissionsMixin):
    """A user identified by email, registered directly or via Google sign-in."""

    email: models.EmailField[str | Combinable, str] = models.EmailField(unique=True)
    display_name: models.CharField[str | Combinable, str] = models.CharField(
        max_length=150,
        blank=True,
    )
    google_sub: models.CharField[str | Combinable | None, str | None] = (
        models.CharField(
            max_length=255,
            unique=True,
            null=True,
            blank=True,
            help_text="Subject identifier returned by Google for this account.",
        )
    )

    is_active = models.BooleanField(default=True)
    is_staff: models.BooleanField[bool | Combinable, bool] = models.BooleanField(
        default=False
    )
    date_joined: models.DateTimeField[
        str | dt.datetime | dt.date | Combinable, dt.datetime
    ] = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    @final
    class Meta(AbstractBaseUser.Meta, PermissionsMixin.Meta):
        """Concrete model; merges the abstract `Meta` of both base classes."""

        abstract = False

    @override
    def __str__(self) -> str:
        """Return the user's email, used throughout the admin and shell."""
        return self.email
