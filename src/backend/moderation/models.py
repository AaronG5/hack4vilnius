"""Staff review records for reports flagged as potentially abusive."""

import datetime as dt
from typing import ClassVar, final, override

from django.db import models
from django.db.models.expressions import Combinable
from reports.models import Report
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel
from vilnius_backend.choices import ModerationFlagStatus


@final
class ModerationFlag(UUIDModel, TimestampedModel):
    """A staff review record created when a report is flagged for abuse."""

    report: models.ForeignKey[Report | Combinable, Report] = models.ForeignKey(
        Report,
        on_delete=models.CASCADE,
        related_name="moderation_flags",
    )
    reason: models.TextField[str | Combinable, str] = models.TextField()
    status: models.CharField[str | Combinable, str] = models.CharField(
        max_length=32,
        choices=ModerationFlagStatus.choices,
        default=ModerationFlagStatus.PENDING,
    )
    reviewed_by: models.ForeignKey[User | Combinable | None, User | None] = (
        models.ForeignKey(
            User,
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            related_name="reviewed_moderation_flags",
        )
    )
    reviewed_at: models.DateTimeField[
        str | dt.datetime | dt.date | Combinable | None, dt.datetime | None
    ] = models.DateTimeField(null=True, blank=True)

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Most recently created first."""

        ordering: ClassVar[list[str]] = ["-created_at"]

    @override
    def __str__(self) -> str:
        """Return the flag's id, used in the admin and shell."""
        return str(self.id)
