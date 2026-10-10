"""App configuration for the districts app."""

from typing import final

from django.apps import AppConfig


@final
class DistrictsConfig(AppConfig):
    """Configuration for the districts app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "districts"
