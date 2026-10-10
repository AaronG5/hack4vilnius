"""App configuration for the media_assets app."""

from typing import final

from django.apps import AppConfig


@final
class MediaAssetsConfig(AppConfig):
    """Configuration for the media_assets app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "media_assets"
    verbose_name = "Media"
