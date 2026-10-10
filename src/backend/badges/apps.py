"""App configuration for the badges app."""

from typing import final

from django.apps import AppConfig


@final
class BadgesConfig(AppConfig):
    """Configuration for the badges app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "badges"
