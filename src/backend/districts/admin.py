"""Admin registration for the `District` model."""

from typing import TYPE_CHECKING, final

from districts.models import District
from django.contrib import admin

if TYPE_CHECKING:
    _DistrictAdminBase = admin.ModelAdmin[District]
else:
    _DistrictAdminBase = admin.ModelAdmin


@final
@admin.register(District)
class DistrictAdmin(_DistrictAdminBase):
    """
    Admin for `District`.

    Per planning/USECASE.md: "Program administrator opens the django admin
    panel, and creates new instance of a district."
    """

    list_display = ("name", "city", "region")
    search_fields = ("name", "city", "region")
