"""The institution responsible for handling problems in a category."""

from typing import ClassVar, final, override

from django.db import models
from django.db.models.expressions import Combinable
from vilnius_backend.base_models import UUIDModel


@final
class Institution(UUIDModel):
    """An entity (city department, utility, etc.) that fixes problems."""

    name: models.CharField[str | Combinable, str] = models.CharField(max_length=255)
    contact_info: models.TextField[str | Combinable, str] = models.TextField()

    class Meta(UUIDModel.Meta):
        """Alphabetical by name, matching admin defaults."""

        ordering: ClassVar[list[str]] = ["name"]

    @override
    def __str__(self) -> str:
        """Return the institution's name, used in the admin and shell."""
        return self.name
