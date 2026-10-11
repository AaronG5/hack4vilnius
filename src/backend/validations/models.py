"""User confirmations (or disputes) of reported problems."""

from typing import ClassVar, final, override

from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.db.models.expressions import Combinable
from media_assets.models import Media, MediaRelation
from problems.models import Problem
from users.models import User
from vilnius_backend.base_models import TimestampedModel, UUIDModel
from vilnius_backend.choices import ProblemUrgency


@final
class Validation(UUIDModel, TimestampedModel):
    """A single user's validation of a problem's existence/status."""

    is_valid: models.BooleanField[bool | Combinable, bool] = models.BooleanField()
    description: models.TextField[str | Combinable, str] = models.TextField(
        blank=True,
        default="",
        help_text="What this resident saw, in more detail than the report.",
    )
    urgency: models.CharField[str | Combinable, str] = models.CharField(
        max_length=32,
        choices=ProblemUrgency.choices,
        blank=True,
        default="",
        help_text="How urgent this resident thinks it is; empty if unsaid.",
    )
    points_awarded: models.IntegerField[int | Combinable, int] = models.IntegerField(
        default=0,
    )
    refuted: models.BooleanField[bool | Combinable, bool] = models.BooleanField(
        default=False,
        help_text="Proved wrong: its problem was canceled as not real.",
    )
    user: models.ForeignKey[User | Combinable, User] = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    problem: models.ForeignKey[Problem | Combinable, Problem] = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    # `MediaRelation` because django-stubs types `GenericRelation` as
    # `ForeignObject[Any, Any]`; see its docstring.
    media: MediaRelation = GenericRelation(  # pyright: ignore[reportAssignmentType]
        Media,
    )

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """One answer per person per problem; most recently created first."""

        ordering: ClassVar[list[str]] = ["-created_at"]
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=["user", "problem"],
                name="unique_validation_per_user_and_problem",
            ),
        ]

    @override
    def __str__(self) -> str:
        """Return the validation's id, used in the admin and shell."""
        return str(self.id)
