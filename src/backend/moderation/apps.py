"""App configuration for the moderation app."""

from typing import final

from django.apps import AppConfig


@final
class ModerationConfig(AppConfig):
    """Configuration for the moderation app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "moderation"
