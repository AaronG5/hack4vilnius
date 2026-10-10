"""Admin registration for the `Institution` model."""

from typing import TYPE_CHECKING, final

from django.contrib import admin
from institutions.models import Institution

if TYPE_CHECKING:
    _InstitutionAdminBase = admin.ModelAdmin[Institution]
else:
    _InstitutionAdminBase = admin.ModelAdmin


@final
@admin.register(Institution)
class InstitutionAdmin(_InstitutionAdminBase):
    """Admin for `Institution`, managed directly by program staff."""

    list_display = ("name", "contact_info")
    search_fields = ("name",)
