"""App configuration for the notifications app."""

from typing import final

from django.apps import AppConfig


@final
class NotificationsConfig(AppConfig):
    """Configuration for the notifications app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
