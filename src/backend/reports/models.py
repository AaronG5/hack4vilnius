"""User reports of problems; multiple reports can point to the same problem."""

from typing import ClassVar, final, override

from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.db.models.expressions import Combinable
from media_assets.models import Media, MediaRelation
from problems.models import Problem
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel


@final
class Report(UUIDModel, TimestampedModel):
    """A single user's report describing a problem."""

    description: models.TextField[str | Combinable, str] = models.TextField()
    ai_category_suggestion: models.CharField[str | Combinable, str] = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Empty string means no suggestion.",
    )
    ai_abuse_flag: models.BooleanField[bool | Combinable, bool] = models.BooleanField(
        default=False,
    )
    refuted: models.BooleanField[bool | Combinable, bool] = models.BooleanField(
        default=False,
        help_text="Proved wrong: its problem was canceled or it was found harmful.",
    )
    points_awarded: models.IntegerField[int | Combinable, int] = models.IntegerField(
        default=0,
        help_text="Paid once the problem is confirmed, not when reported.",
    )
    user: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    problem: models.ForeignKey[Problem | Combinable, Problem] = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    # `MediaRelation` because django-stubs types `GenericRelation` as
    # `ForeignObject[Any, Any]`; see its docstring.
    media: MediaRelation = GenericRelation(  # pyright: ignore[reportAssignmentType]
        Media,
    )

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Most recently created first."""

        ordering: ClassVar[list[str]] = ["-created_at"]

    @override
    def __str__(self) -> str:
        """Return the report's id, used in the admin and shell."""
        return str(self.id)
