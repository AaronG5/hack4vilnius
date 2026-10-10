"""Admin registration for the `Notification` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from notifications.models import Notification

if TYPE_CHECKING:
    _NotificationAdminBase = admin.ModelAdmin[Notification]
else:
    _NotificationAdminBase = admin.ModelAdmin


@final
@admin.register(Notification)
class NotificationAdmin(_NotificationAdminBase):
    """Read-only-ish admin view of notifications."""

    list_display = ("id", "user", "event_type", "read", "created_at")
    list_filter = ("event_type", "read")
    readonly_fields = ("id", "created_at")
