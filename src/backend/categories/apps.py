"""App configuration for the categories app."""

from typing import final

from django.apps import AppConfig


@final
class CategoriesConfig(AppConfig):
    """Configuration for the categories app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "categories"
