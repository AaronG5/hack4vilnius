"""Admin registration for the `ModerationFlag` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from moderation.models import ModerationFlag

if TYPE_CHECKING:
    _ModerationFlagAdminBase = admin.ModelAdmin[ModerationFlag]
else:
    _ModerationFlagAdminBase = admin.ModelAdmin


@final
@admin.register(ModerationFlag)
class ModerationFlagAdmin(_ModerationFlagAdminBase):
    """Admin for `ModerationFlag`, letting staff review by hand too."""

    list_display = ("id", "report", "status", "reviewed_by", "reviewed_at")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at")
