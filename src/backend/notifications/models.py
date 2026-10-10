"""Messages sent to a user when a problem/report they're involved with changes."""

from typing import ClassVar, final, override

from django.db import models
from django.db.models.expressions import Combinable
from problems.models import Problem
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel


@final
class Notification(UUIDModel, TimestampedModel):
    """A single notification for one user."""

    user: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    message: models.TextField[str | Combinable, str] = models.TextField()
    event_type: models.CharField[str | Combinable, str] = models.CharField(
        max_length=64,
        help_text="e.g. status_changed, points_awarded.",
    )
    read: models.BooleanField[bool | Combinable, bool] = models.BooleanField(
        default=False
    )
    problem: models.ForeignKey[Problem | Combinable | None, Problem | None] = (
        models.ForeignKey(
            Problem,
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            related_name="notifications",
        )
    )

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Most recently created first."""

        ordering: ClassVar[list[str]] = ["-created_at"]

    @override
    def __str__(self) -> str:
        """Return the notification's id, used in the admin and shell."""
        return str(self.id)
