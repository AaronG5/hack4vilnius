"""Admin registration for the `Problem` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from problems.models import Problem

if TYPE_CHECKING:
    _ProblemAdminBase = admin.ModelAdmin[Problem]
else:
    _ProblemAdminBase = admin.ModelAdmin


@final
@admin.register(Problem)
class ProblemAdmin(_ProblemAdminBase):
    """Admin for `Problem`, letting staff review and update status by hand."""

    list_display = ("id", "category", "status", "urgency", "created_at")
    list_filter = ("status", "urgency", "category")
    readonly_fields = ("id", "created_at", "updated_at")
