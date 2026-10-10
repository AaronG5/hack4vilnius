"""App configuration for the challenges app."""

from typing import final

from django.apps import AppConfig


@final
class ChallengesConfig(AppConfig):
    """Configuration for the challenges app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "challenges"
