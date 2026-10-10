"""
Shared GeoJSON serializers for `GeoPoint` and `GeoPolygon` fields.

Geometry is stored as plain `JSONField` (no PostGIS); these serializers only
validate the GeoJSON envelope shape used by the OpenAPI contract.
"""

from typing import final

from rest_framework import serializers


@final
class GeoPointSerializer(serializers.Serializer[dict[str, object]]):
    """A GeoJSON `Point`: `{"type": "Point", "coordinates": [lng, lat]}`."""

    type = serializers.ChoiceField(choices=["Point"])
    coordinates = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
    )


@final
class GeoPolygonSerializer(serializers.Serializer[dict[str, object]]):
    """A GeoJSON `Polygon`: a list of linear rings of `[lng, lat]` pairs."""

    type = serializers.ChoiceField(choices=["Polygon"])
    coordinates = serializers.ListField(
        child=serializers.ListField(
            child=serializers.ListField(
                child=serializers.FloatField(),
                min_length=2,
                max_length=2,
            ),
        ),
    )
