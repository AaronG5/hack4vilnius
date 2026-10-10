"""Admin registration for `Badge` and `UserBadge`."""

from typing import TYPE_CHECKING, final

from badges.models import Badge, UserBadge
from django.contrib import admin

if TYPE_CHECKING:
    _BadgeAdminBase = admin.ModelAdmin[Badge]
    _UserBadgeAdminBase = admin.ModelAdmin[UserBadge]
else:
    _BadgeAdminBase = admin.ModelAdmin
    _UserBadgeAdminBase = admin.ModelAdmin


@final
@admin.register(Badge)
class BadgeAdmin(_BadgeAdminBase):
    """Admin for `Badge`."""

    list_display = ("name", "required_validation_count", "district")
    search_fields = ("name", "description")


@final
@admin.register(UserBadge)
class UserBadgeAdmin(_UserBadgeAdminBase):
    """Read-only admin view of earned badges."""

    list_display = ("user", "badge", "created_at")
    readonly_fields = ("id", "created_at")
