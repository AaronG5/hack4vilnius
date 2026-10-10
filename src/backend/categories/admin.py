"""Admin registration for the `Category` model."""

from typing import TYPE_CHECKING, final

from categories.models import Category
from django.contrib import admin

if TYPE_CHECKING:
    _CategoryAdminBase = admin.ModelAdmin[Category]
else:
    _CategoryAdminBase = admin.ModelAdmin


@final
@admin.register(Category)
class CategoryAdmin(_CategoryAdminBase):
    """Admin for `Category`."""

    list_display = ("name", "default_urgency", "institution")
    list_filter = ("default_urgency", "institution")
    search_fields = ("name", "description")
