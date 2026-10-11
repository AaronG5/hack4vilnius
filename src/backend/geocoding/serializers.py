"""Serializer for the geocoder's query string."""

from typing import final

from geocoding.routing import MAX_STOPS
from rest_framework import serializers

MIN_QUERY_LENGTH = 3
MAX_QUERY_LENGTH = 200
MAX_RESULTS = 10
DEFAULT_RESULTS = 5


@final
class GeocodeQuerySerializer(serializers.Serializer[object]):
    """Validates the query string of `GET /api/geocode`."""

    q: serializers.CharField = serializers.CharField(
        min_length=MIN_QUERY_LENGTH,
        max_length=MAX_QUERY_LENGTH,
        trim_whitespace=True,
    )
    limit: serializers.IntegerField = serializers.IntegerField(
        min_value=1,
        max_value=MAX_RESULTS,
        required=False,
        default=DEFAULT_RESULTS,
    )


_MIN_STOPS = 2
_MAX_LATITUDE = 90
_MAX_LONGITUDE = 180


@final
class WalkingRouteQuerySerializer(serializers.Serializer[object]):
    """Validates `GET /api/routes/walk?stops=lng,lat;lng,lat;...`."""

    stops: serializers.CharField = serializers.CharField(max_length=500)

    def validate_stops(self, value: str) -> tuple[tuple[float, float], ...]:
        """Parse the stops into `(longitude, latitude)` pairs, 2 to MAX_STOPS."""
        pairs: list[tuple[float, float]] = []
        for part in value.split(";"):
            try:
                longitude, latitude = (float(x) for x in part.split(","))
            except ValueError as error:
                msg = 'Stops are "longitude,latitude" pairs separated by ";".'
                raise serializers.ValidationError(msg) from error
            if abs(longitude) > _MAX_LONGITUDE or abs(latitude) > _MAX_LATITUDE:
                msg = "A stop is outside the valid coordinate range."
                raise serializers.ValidationError(msg)
            pairs.append((longitude, latitude))
        if not _MIN_STOPS <= len(pairs) <= MAX_STOPS:
            msg = f"A walk has {_MIN_STOPS} to {MAX_STOPS} stops."
            raise serializers.ValidationError(msg)
        return tuple(pairs)
