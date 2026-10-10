"""App configuration for the reports app."""

from typing import final

from django.apps import AppConfig


@final
class ReportsConfig(AppConfig):
    """Configuration for the reports app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "reports"
