"""Admin registration for the `Validation` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from validations.models import Validation

if TYPE_CHECKING:
    _ValidationAdminBase = admin.ModelAdmin[Validation]
else:
    _ValidationAdminBase = admin.ModelAdmin


@final
@admin.register(Validation)
class ValidationAdmin(_ValidationAdminBase):
    """Admin for `Validation`."""

    list_display = ("id", "problem", "user", "is_valid", "points_awarded", "created_at")
    list_filter = ("is_valid",)
    readonly_fields = ("id", "created_at")
