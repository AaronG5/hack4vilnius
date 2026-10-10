"""Badges users can earn, and the record of who has earned which."""

from typing import ClassVar, final, override

from districts.models import District
from django.db import models
from django.db.models.expressions import Combinable
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel


@final
class Badge(UUIDModel):
    """A badge a user can earn."""

    name: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    description: models.TextField[str | Combinable, str] = models.TextField()
    icon: models.URLField[str | Combinable, str] = models.URLField()
    criteria: models.TextField[str | Combinable, str] = models.TextField(
        help_text="Human-readable rule that triggers awarding it.",
    )
    required_validation_count: models.IntegerField[
        int | Combinable | None, int | None
    ] = models.IntegerField(
        null=True,
        blank=True,
        help_text="Validations needed; null if not count-based.",
    )
    district: models.ForeignKey[District | Combinable | None, District | None] = (
        models.ForeignKey(
            District,
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            related_name="badges",
            help_text="Restricts the count to one district when set.",
        )
    )
    users: models.ManyToManyField[User, User] = models.ManyToManyField(
        User,
        through="badges.UserBadge",
        related_name="badges",
    )

    class Meta(UUIDModel.Meta):
        """Alphabetical by name, matching admin defaults."""

        ordering: ClassVar[list[str]] = ["name"]

    @override
    def __str__(self) -> str:
        """Return the badge's name, used in the admin and shell."""
        return self.name


@final
class UserBadge(UUIDModel, TimestampedModel):
    """Records that `user` earned `badge`, and when."""

    user: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
    )
    badge: models.ForeignKey[Badge | Combinable, Badge] = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
    )

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """One award per user/badge pair; most recent first."""

        ordering: ClassVar[list[str]] = ["-created_at"]
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(fields=["user", "badge"], name="unique_user_badge"),
        ]

    @override
    def __str__(self) -> str:
        """Return a human-readable label, used in the admin and shell."""
        return f"{self.user} earned {self.badge}"
