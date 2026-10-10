"""Serializer for the geocoder's query string."""

from typing import final

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
