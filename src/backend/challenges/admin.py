"""Admin registration for the `Challenge` model."""

from typing import TYPE_CHECKING, final

from challenges.models import Challenge
from django.contrib import admin

if TYPE_CHECKING:
    _ChallengeAdminBase = admin.ModelAdmin[Challenge]
else:
    _ChallengeAdminBase = admin.ModelAdmin


@final
@admin.register(Challenge)
class ChallengeAdmin(_ChallengeAdminBase):
    """Admin for `Challenge`."""

    list_display = ("name", "status", "start_date", "end_date", "reward_points")
    list_filter = ("status",)
    search_fields = ("name", "description")
    filter_horizontal = ("categories", "participants")
