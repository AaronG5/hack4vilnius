"""Admin registration for the `User` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from users.models import User

if TYPE_CHECKING:
    # `UserAdmin` is only generic for type checkers; django-stubs declares it as
    # `ModelAdmin[_UserType]` but Django's real class has no `__class_getitem__`,
    # so subscripting it at runtime raises TypeError.
    _UserAdminBase = DjangoUserAdmin[User]
else:
    _UserAdminBase = DjangoUserAdmin


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
