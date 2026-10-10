"""App configuration for the validations app."""

from typing import final

from django.apps import AppConfig


@final
class ValidationsConfig(AppConfig):
    """Configuration for the validations app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "validations"
