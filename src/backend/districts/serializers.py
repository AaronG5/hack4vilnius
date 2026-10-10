"""Serializers for `District`."""

from typing import final

from districts.models import District
from rest_framework import serializers
from vilnius_backend.geo import GeoPolygonSerializer


@final
class DistrictSerializer(serializers.ModelSerializer[District]):
    """Public representation of a `District`."""

    boundary = GeoPolygonSerializer()

    @final
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        """Expose every contract field; `id` is read-only."""

        model = District
        fields = ("id", "name", "boundary", "city", "region")
        read_only_fields = ("id",)
