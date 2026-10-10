"""Problems reported in the city."""

import datetime as dt
from typing import ClassVar, final, override

from categories.models import Category
from django.db import models
from django.db.models.expressions import Combinable
from institutions.models import Institution
from vilnius_backend.base_models import TimestampedModel, UUIDModel
from vilnius_backend.choices import ProblemStatus, ProblemUrgency


@final
class Problem(UUIDModel, TimestampedModel):
    """
    A city problem, built up from one or more `Report`s.

    No `district` is stored: a problem's district is computed dynamically
    from `location` against district boundaries, per
    planning/ARCHITECTURE.md.
    """

    status: models.CharField[str | Combinable, str] = models.CharField(
        max_length=16,
        choices=ProblemStatus.choices,
        default=ProblemStatus.UNCONFIRMED,
    )
    urgency: models.CharField[str | Combinable, str] = models.CharField(
        max_length=32,
        choices=ProblemUrgency.choices,
        help_text="Current consensus: what most residents voted for.",
    )
    reported_urgency: models.CharField[str | Combinable, str] = models.CharField(
        max_length=32,
        choices=ProblemUrgency.choices,
        blank=True,
        default="",
        help_text=(
            "What the first report said, counted as the reporter's own vote. "
            "Never changes, so re-tallying can't drift."
        ),
    )
    legitimacy_score: models.FloatField[float | Combinable, float] = models.FloatField(
        help_text="AI-estimated percentage, 0-100.",
    )
    location: models.JSONField[object, object] = models.JSONField(
        help_text="GeoJSON Point.",
    )
    category: models.ForeignKey[Category | Combinable, Category] = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="problems",
    )
    institution: models.ForeignKey[
        Institution | Combinable | None, Institution | None
    ] = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="problems",
        help_text="Institution currently handling it, once confirmed.",
    )
    updated_at: models.DateTimeField[
        str | dt.datetime | dt.date | Combinable, dt.datetime
    ] = models.DateTimeField(auto_now=True)

    class Meta(UUIDModel.Meta, TimestampedModel.Meta):
        """Most recently created first."""

        ordering: ClassVar[list[str]] = ["-created_at"]

    @override
    def __str__(self) -> str:
        """Return a human-readable label, used in the admin and shell."""
        return f"{self.category.name} ({self.status})"
