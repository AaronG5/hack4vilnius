"""Classification assigned to a problem/report."""

from typing import ClassVar, final, override

from django.db import models
from django.db.models.expressions import Combinable
from institutions.models import Institution
from vilnius_backend.base_models import UUIDModel
from vilnius_backend.choices import ProblemUrgency


@final
class Category(UUIDModel):
    """A problem/report classification, e.g. pothole, plant disease, other."""

    name: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    description: models.TextField[str | Combinable, str] = models.TextField()
    icon: models.URLField[str | Combinable, str] = models.URLField()
    default_urgency: models.CharField[str | Combinable, str] = models.CharField(
        max_length=32,
        choices=ProblemUrgency.choices,
        help_text="Fallback urgency used when AI can't determine one.",
    )
    institution: models.ForeignKey[
        Institution | Combinable | None, Institution | None
    ] = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
        help_text="Institution responsible for this category.",
    )

    class Meta(UUIDModel.Meta):
        """Alphabetical by name, matching admin defaults."""

        ordering: ClassVar[list[str]] = ["name"]
        verbose_name_plural: ClassVar[str] = "categories"

    @override
    def __str__(self) -> str:
        """Return the category's name, used in the admin and shell."""
        return self.name
