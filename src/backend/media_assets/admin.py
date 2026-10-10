"""Admin registration for the `Media` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from media_assets.models import Media

if TYPE_CHECKING:
    _MediaAdminBase = admin.ModelAdmin[Media]
else:
    _MediaAdminBase = admin.ModelAdmin


@final
@admin.register(Media)
class MediaAdmin(_MediaAdminBase):
    """Read-only-ish admin view of uploaded media."""

    list_display = ("id", "type", "uploaded_by", "created_at")
    list_filter = ("type",)
    readonly_fields = ("id", "created_at")
