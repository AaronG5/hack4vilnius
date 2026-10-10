"""App configuration for the problems app."""

from typing import final

from django.apps import AppConfig


@final
class ProblemsConfig(AppConfig):
    """Configuration for the problems app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "problems"
