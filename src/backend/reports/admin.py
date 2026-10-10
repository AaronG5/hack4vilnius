"""Admin registration for the `Report` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from reports.models import Report

if TYPE_CHECKING:
    _ReportAdminBase = admin.ModelAdmin[Report]
else:
    _ReportAdminBase = admin.ModelAdmin


@final
@admin.register(Report)
class ReportAdmin(_ReportAdminBase):
    """Admin for `Report`."""

    list_display = ("id", "problem", "user", "ai_abuse_flag", "created_at")
    list_filter = ("ai_abuse_flag",)
    readonly_fields = ("id", "created_at")
