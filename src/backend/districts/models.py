"""Geographical districts that users belong to and problems fall within."""

from typing import ClassVar, final, override

from django.db import models
from django.db.models.expressions import Combinable
from vilnius_backend.base_models import UUIDModel


@final
class District(UUIDModel):
    """
    A city district.

    No link to `Problem` is stored here: a problem's district is computed
    dynamically from its `location` against district boundaries, see
    `districts.services.get_district_for_point`.
    """

    name: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    boundary: models.JSONField[object, object] = models.JSONField(
        help_text="GeoJSON Polygon.",
    )
    city: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    region: models.CharField[str | Combinable, str] = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    class Meta(UUIDModel.Meta):
        """Alphabetical by name, matching admin defaults."""

        ordering: ClassVar[list[str]] = ["name"]

    @override
    def __str__(self) -> str:
        """Return the district's name, used in the admin and shell."""
        return self.name
