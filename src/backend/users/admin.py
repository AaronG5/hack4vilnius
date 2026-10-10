"""Admin registration for the `User` model."""

from typing import TYPE_CHECKING, final, override

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpRequest
from users.models import AnonymousIdentity, User

if TYPE_CHECKING:
    # `UserAdmin`/`ModelAdmin` are only generic for type checkers; django-stubs
    # declares them as `ModelAdmin[_ModelT]` but Django's real classes have no
    # `__class_getitem__`, so subscripting them at runtime raises TypeError.
    _UserAdminBase = DjangoUserAdmin[User]
    _AnonymousIdentityAdminBase = admin.ModelAdmin[AnonymousIdentity]
else:
    _UserAdminBase = DjangoUserAdmin
    _AnonymousIdentityAdminBase = admin.ModelAdmin


@final
@admin.register(User)
class UserAdmin(_UserAdminBase):
    """Admin for the email-based `User` model."""

    ordering = ("email",)
    list_display = ("email", "display_name", "is_staff", "is_active")
    search_fields = ("email", "display_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("display_name", "google_sub")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets: tuple[tuple[str | None, dict[str, object]], ...] = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )
    readonly_fields = ("date_joined",)


@final
@admin.register(AnonymousIdentity)
class AnonymousIdentityAdmin(_AnonymousIdentityAdminBase):
    """Read-only admin view of cookie-tracked anonymous visitors."""

    list_display = ("id", "created_at", "claimed_by", "claimed_at")
    list_filter = ("claimed_at",)
    readonly_fields = ("id", "created_at", "claimed_by", "claimed_at")

    @override
    def has_add_permission(self, request: HttpRequest) -> bool:
        """Identities are only ever created by the API, never by hand."""
        return False
