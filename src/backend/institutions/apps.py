"""App configuration for the institutions app."""

from typing import final

from django.apps import AppConfig


@final
class InstitutionsConfig(AppConfig):
    """Configuration for the institutions app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "institutions"
