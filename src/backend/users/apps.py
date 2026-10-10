"""App configuration for the users app."""

from typing import final

from django.apps import AppConfig


@final
class UsersConfig(AppConfig):
    """Configuration for the users app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
